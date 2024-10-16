/* A wrapper for the "qaap/uws-bindings" library. */
"use strict";
import WebSocket from "ws";
/**
 * factory method for common WebSocket instance
 * @method
 * @param {String} address - url to a websocket server
 * @param {(Object)} options - websocket options
 * @return {Undefined}
 */
export default function (address, options) {
    return (typeof address === "function" ? address() : Promise.resolve(address))
        .then((address) => new WebSocket(address, options));
}
