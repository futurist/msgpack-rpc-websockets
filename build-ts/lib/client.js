/**
 * "Client" wraps "ws" or a browser-implemented "WebSocket" library
 * according to the environment providing MessagePack support on top.
 * @module Client
 */
"use strict";
// @ts-ignore
import { EventEmitter } from "eventemitter3";
// import msgpack from "tiny-msgpack"
import * as msgpack from "@msgpack/msgpack";
export default class CommonClient extends EventEmitter {
    /**
     * Instantiate a Client class.
     * @constructor
     * @param {webSocketFactory} webSocketFactory - factory method for WebSocket
     * @param {String} address - url to a websocket server
     * @param {Object} options - ws options object with reconnect parameters
     * @param {Function} generate_request_id - custom generation request Id
     * @return {CommonClient}
     */
    constructor(webSocketFactory, address = "ws://localhost:8080", options = {}, generate_request_id) {
        super();
        this.webSocketFactory = webSocketFactory;
        this.options = options;
        const { autoconnect = true, reconnect = true, reconnect_interval = 1000, max_reconnects = 5 } = options;
        this.queue = {};
        this.rpc_id = 0;
        this.address = address;
        this.autoconnect = autoconnect;
        this.ready = false;
        this.reconnect = reconnect;
        this.reconnect_interval = reconnect_interval;
        this.max_reconnects = max_reconnects;
        this.current_reconnects = 0;
        this.generate_request_id = generate_request_id || (() => ++this.rpc_id);
        if (this.autoconnect)
            this._connect(this.address, Object.assign(Object.assign({}, this.options), { autoconnect: this.autoconnect, reconnect: this.reconnect, reconnect_interval: this.reconnect_interval, max_reconnects: this.max_reconnects }));
    }
    /**
     * Connects to a defined server if not connected already.
     * @method
     * @return {Undefined}
     */
    connect() {
        if (this.socket)
            return;
        this._connect(this.address, {
            autoconnect: this.autoconnect,
            reconnect: this.reconnect,
            reconnect_interval: this.reconnect_interval,
            max_reconnects: this.max_reconnects
        });
    }
    /**
     * Calls a registered RPC method on server.
     * @method
     * @param {String} method - RPC method name
     * @param {Object|Array} params - optional method parameters
     * @param {Number} timeout - RPC reply timeout value
     * @param {Object} ws_opts - options passed to ws
     * @return {Promise}
     */
    call(method, params, timeout, ws_opts) {
        if (!ws_opts && "object" === typeof timeout) {
            ws_opts = timeout;
            timeout = null;
        }
        return new Promise((resolve, reject) => {
            if (!this.ready)
                return reject(new Error("socket not ready"));
            const rpc_id = this.generate_request_id(method, params);
            const message = {
                method: method,
                params: params || null,
                id: rpc_id
            };
            this.socket.send(msgpack.encode(message), ws_opts, (error) => {
                if (error)
                    return reject(error);
                this.queue[rpc_id] = { promise: [resolve, reject] };
                if (timeout) {
                    this.queue[rpc_id].timeout = setTimeout(() => {
                        this.queue[rpc_id] = null;
                        reject(new Error("reply timeout"));
                    }, timeout);
                }
            });
        });
    }
    /**
     * Logins with the other side of the connection.
     * @method
     * @param {Object} params - Login credentials object
     * @return {Promise}
     */
    async login(params) {
        const resp = await this.call("rpc.login", params);
        if (!resp)
            throw new Error("authentication failed");
    }
    /**
     * Fetches a list of client's methods registered on server.
     * @method
     * @return {Array}
     */
    async listMethods() {
        return await this.call("__listMethods");
    }
    /**
     * Sends a MSGPACK notification to server.
     * @method
     * @param {String} method - RPC method name
     * @param {Object} params - optional method parameters
     * @return {Promise}
     */
    notify(method, params) {
        return new Promise((resolve, reject) => {
            if (!this.ready)
                return reject(new Error("socket not ready"));
            const message = {
                // jsonrpc: "2.0",
                method: method,
                params: params || null
            };
            this.socket.send(msgpack.encode(message), (error) => {
                if (error)
                    return reject(error);
                resolve();
            });
        });
    }
    /**
     * Subscribes for a defined event.
     * @method
     * @param {String|Array} event - event name
     * @return {Undefined}
     * @throws {Error}
     */
    async subscribe(event) {
        if (typeof event === "string")
            event = [event];
        const result = await this.call("rpc.on", event);
        if (typeof event === "string" && result[event] !== "ok")
            throw new Error("Failed subscribing to an event '" + event + "' with: " + result[event]);
        return result;
    }
    /**
     * Unsubscribes from a defined event.
     * @method
     * @param {String|Array} event - event name
     * @return {Undefined}
     * @throws {Error}
     */
    async unsubscribe(event) {
        if (typeof event === "string")
            event = [event];
        const result = await this.call("rpc.off", event);
        if (typeof event === "string" && result[event] !== "ok")
            throw new Error("Failed unsubscribing from an event with: " + result);
        return result;
    }
    /**
     * Closes a WebSocket connection gracefully.
     * @method
     * @param {Number} code - socket close code
     * @param {String} data - optional data to be sent before closing
     * @return {Undefined}
     */
    close(code, data) {
        this.socket.close(code || 1000, data);
    }
    /**
     * Connection/Message handler.
     * @method
     * @private
     * @param {String} address - WebSocket API address
     * @param {Object} options - ws options object
     * @return {Undefined}
     */
    async _connect(address, options) {
        this.socket = await this.webSocketFactory(address, options);
        this.socket.addEventListener("open", () => {
            this.ready = true;
            this.emit("open");
            this.current_reconnects = 0;
        });
        this.socket.addEventListener("message", async ({ data: message }) => {
            // if (message instanceof ArrayBuffer)
            //     message = Buffer.from(message).toString()
            try {
                if (typeof Blob !== "undefined" && message instanceof Blob) {
                    // message = new Uint8Array(await message.arrayBuffer())
                    message = message.stream
                        ? await msgpack.decodeAsync(message.stream())
                        : msgpack.decode(await message.arrayBuffer());
                }
                else {
                    message = msgpack.decode(message);
                }
            }
            catch (error) {
                console.log("decode error:", error);
                return;
            }
            // check if any listeners are attached and forward event
            if (message.notification && this.listeners(message.notification).length) {
                if (!Object.keys(message.params).length)
                    return this.emit(message.notification);
                const args = [message.notification];
                if (message.params.constructor === Object)
                    args.push(message.params);
                else
                    // using for-loop instead of unshift/spread because performance is better
                    for (let i = 0; i < message.params.length; i++)
                        args.push(message.params[i]);
                // run as microtask so that pending queue messages are resolved first
                // eslint-disable-next-line prefer-spread
                return Promise.resolve().then(() => { this.emit.apply(this, args); });
            }
            if (!this.queue[message.id]) {
                // general MessagePack events
                if (message.method && message.params) {
                    // run as microtask so that pending queue messages are resolved first
                    return Promise.resolve().then(() => {
                        this.emit(message.method, message.params);
                    });
                }
                return;
            }
            // reject early since server's response is invalid
            if ("error" in message === "result" in message)
                this.queue[message.id].promise[1](new Error("Server response malformed. Response must include either \"result\"" +
                    " or \"error\", but not both."));
            if (this.queue[message.id].timeout)
                clearTimeout(this.queue[message.id].timeout);
            if (message.error) {
                Object.defineProperty(message.error, "__request_id", {
                    value: message.id,
                });
                this.queue[message.id].promise[1](message.error);
            }
            else {
                let result = message.result;
                if (result) {
                    result = Object.defineProperty(Object(result), "__request_id", {
                        value: message.id,
                    });
                }
                this.queue[message.id].promise[0](result);
            }
            this.queue[message.id] = null;
        });
        this.socket.addEventListener("error", (error) => this.emit("error", error));
        this.socket.addEventListener("close", ({ code, reason }) => {
            if (this.ready) // Delay close event until internal state is updated
                setTimeout(() => this.emit("close", code, reason), 0);
            this.ready = false;
            this.socket = undefined;
            if (code === 1000)
                return;
            this.current_reconnects++;
            if (this.reconnect && ((this.max_reconnects > this.current_reconnects) ||
                this.max_reconnects === 0))
                setTimeout(() => this._connect(address, options), this.reconnect_interval);
        });
    }
}
