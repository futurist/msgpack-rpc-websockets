/**
 * "Client" wraps "ws" or a browser-implemented "WebSocket" library
 * according to the environment providing MessagePack support on top.
 * @module Client
 */
"use strict"; // @ts-ignore

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _inherits2 = _interopRequireDefault(require("@babel/runtime/helpers/inherits"));

var _possibleConstructorReturn2 = _interopRequireDefault(require("@babel/runtime/helpers/possibleConstructorReturn"));

var _getPrototypeOf2 = _interopRequireDefault(require("@babel/runtime/helpers/getPrototypeOf"));

var _eventemitter = require("eventemitter3");

var msgpack = _interopRequireWildcard(require("@msgpack/msgpack"));

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = (0, _getPrototypeOf2["default"])(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = (0, _getPrototypeOf2["default"])(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return (0, _possibleConstructorReturn2["default"])(this, result); }; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

var CommonClient = /*#__PURE__*/function (_EventEmitter) {
  (0, _inherits2["default"])(CommonClient, _EventEmitter);

  var _super = _createSuper(CommonClient);

  /**
   * Instantiate a Client class.
   * @constructor
   * @param {webSocketFactory} webSocketFactory - factory method for WebSocket
   * @param {String} address - url to a websocket server
   * @param {Object} options - ws options object with reconnect parameters
   * @param {Function} generate_request_id - custom generation request Id
   * @return {CommonClient}
   */
  function CommonClient(webSocketFactory) {
    var _this;

    var address = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "ws://localhost:8080";
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var generate_request_id = arguments.length > 3 ? arguments[3] : undefined;
    (0, _classCallCheck2["default"])(this, CommonClient);
    _this = _super.call(this);
    _this.webSocketFactory = webSocketFactory;
    _this.options = options;
    var _options$autoconnect = options.autoconnect,
        autoconnect = _options$autoconnect === void 0 ? true : _options$autoconnect,
        _options$reconnect = options.reconnect,
        reconnect = _options$reconnect === void 0 ? true : _options$reconnect,
        _options$reconnect_in = options.reconnect_interval,
        reconnect_interval = _options$reconnect_in === void 0 ? 1000 : _options$reconnect_in,
        _options$max_reconnec = options.max_reconnects,
        max_reconnects = _options$max_reconnec === void 0 ? 5 : _options$max_reconnec;
    _this.queue = {};
    _this.rpc_id = 0;
    _this.address = address;
    _this.autoconnect = autoconnect;
    _this.ready = false;
    _this.reconnect = reconnect;
    _this.reconnect_interval = reconnect_interval;
    _this.max_reconnects = max_reconnects;
    _this.current_reconnects = 0;

    _this.generate_request_id = generate_request_id || function () {
      return ++_this.rpc_id;
    };

    if (_this.autoconnect) _this._connect(_this.address, Object.assign(Object.assign({}, _this.options), {
      autoconnect: _this.autoconnect,
      reconnect: _this.reconnect,
      reconnect_interval: _this.reconnect_interval,
      max_reconnects: _this.max_reconnects
    }));
    return _this;
  }
  /**
   * Connects to a defined server if not connected already.
   * @method
   * @return {Undefined}
   */


  (0, _createClass2["default"])(CommonClient, [{
    key: "connect",
    value: function connect() {
      if (this.socket) return;

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

  }, {
    key: "call",
    value: function call(method, params, timeout, ws_opts) {
      var _this2 = this;

      if (!ws_opts && "object" === (0, _typeof2["default"])(timeout)) {
        ws_opts = timeout;
        timeout = null;
      }

      return new Promise(function (resolve, reject) {
        if (!_this2.ready) return reject(new Error("socket not ready"));

        var rpc_id = _this2.generate_request_id(method, params);

        var message = {
          method: method,
          params: params || null,
          id: rpc_id
        };

        _this2.socket.send(msgpack.encode(message), ws_opts, function (error) {
          if (error) return reject(error);
          _this2.queue[rpc_id] = {
            promise: [resolve, reject]
          };

          if (timeout) {
            _this2.queue[rpc_id].timeout = setTimeout(function () {
              _this2.queue[rpc_id] = null;
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

  }, {
    key: "login",
    value: function () {
      var _login = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(params) {
        var resp;
        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.call("rpc.login", params);

              case 2:
                resp = _context.sent;

                if (resp) {
                  _context.next = 5;
                  break;
                }

                throw new Error("authentication failed");

              case 5:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function login(_x) {
        return _login.apply(this, arguments);
      }

      return login;
    }()
    /**
     * Fetches a list of client's methods registered on server.
     * @method
     * @return {Array}
     */

  }, {
    key: "listMethods",
    value: function () {
      var _listMethods = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2() {
        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.call("__listMethods");

              case 2:
                return _context2.abrupt("return", _context2.sent);

              case 3:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function listMethods() {
        return _listMethods.apply(this, arguments);
      }

      return listMethods;
    }()
    /**
     * Sends a MSGPACK notification to server.
     * @method
     * @param {String} method - RPC method name
     * @param {Object} params - optional method parameters
     * @return {Promise}
     */

  }, {
    key: "notify",
    value: function notify(method, params) {
      var _this3 = this;

      return new Promise(function (resolve, reject) {
        if (!_this3.ready) return reject(new Error("socket not ready"));
        var message = {
          // jsonrpc: "2.0",
          method: method,
          params: params || null
        };

        _this3.socket.send(msgpack.encode(message), function (error) {
          if (error) return reject(error);
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

  }, {
    key: "subscribe",
    value: function () {
      var _subscribe = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3(event) {
        var result;
        return _regenerator["default"].wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (typeof event === "string") event = [event];
                _context3.next = 3;
                return this.call("rpc.on", event);

              case 3:
                result = _context3.sent;

                if (!(typeof event === "string" && result[event] !== "ok")) {
                  _context3.next = 6;
                  break;
                }

                throw new Error("Failed subscribing to an event '" + event + "' with: " + result[event]);

              case 6:
                return _context3.abrupt("return", result);

              case 7:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function subscribe(_x2) {
        return _subscribe.apply(this, arguments);
      }

      return subscribe;
    }()
    /**
     * Unsubscribes from a defined event.
     * @method
     * @param {String|Array} event - event name
     * @return {Undefined}
     * @throws {Error}
     */

  }, {
    key: "unsubscribe",
    value: function () {
      var _unsubscribe = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(event) {
        var result;
        return _regenerator["default"].wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (typeof event === "string") event = [event];
                _context4.next = 3;
                return this.call("rpc.off", event);

              case 3:
                result = _context4.sent;

                if (!(typeof event === "string" && result[event] !== "ok")) {
                  _context4.next = 6;
                  break;
                }

                throw new Error("Failed unsubscribing from an event with: " + result);

              case 6:
                return _context4.abrupt("return", result);

              case 7:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function unsubscribe(_x3) {
        return _unsubscribe.apply(this, arguments);
      }

      return unsubscribe;
    }()
    /**
     * Closes a WebSocket connection gracefully.
     * @method
     * @param {Number} code - socket close code
     * @param {String} data - optional data to be sent before closing
     * @return {Undefined}
     */

  }, {
    key: "close",
    value: function close(code, data) {
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

  }, {
    key: "_connect",
    value: function () {
      var _connect2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee6(address, options) {
        var _this4 = this;

        return _regenerator["default"].wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this.webSocketFactory(address, options);

              case 2:
                this.socket = _context6.sent;
                this.socket.addEventListener("open", function () {
                  _this4.ready = true;

                  _this4.emit("open");

                  _this4.current_reconnects = 0;
                });
                this.socket.addEventListener("message", /*#__PURE__*/function () {
                  var _ref2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee5(_ref) {
                    var message, args, i, result;
                    return _regenerator["default"].wrap(function _callee5$(_context5) {
                      while (1) {
                        switch (_context5.prev = _context5.next) {
                          case 0:
                            message = _ref.data;
                            _context5.prev = 1;

                            if (!(typeof Blob !== "undefined" && message instanceof Blob)) {
                              _context5.next = 17;
                              break;
                            }

                            if (!message.stream) {
                              _context5.next = 9;
                              break;
                            }

                            _context5.next = 6;
                            return msgpack.decodeAsync(message.stream());

                          case 6:
                            _context5.t0 = _context5.sent;
                            _context5.next = 14;
                            break;

                          case 9:
                            _context5.t1 = msgpack;
                            _context5.next = 12;
                            return message.arrayBuffer();

                          case 12:
                            _context5.t2 = _context5.sent;
                            _context5.t0 = _context5.t1.decode.call(_context5.t1, _context5.t2);

                          case 14:
                            message = _context5.t0;
                            _context5.next = 18;
                            break;

                          case 17:
                            message = msgpack.decode(message);

                          case 18:
                            _context5.next = 24;
                            break;

                          case 20:
                            _context5.prev = 20;
                            _context5.t3 = _context5["catch"](1);
                            console.log("decode error:", _context5.t3);
                            return _context5.abrupt("return");

                          case 24:
                            if (!(message.notification && _this4.listeners(message.notification).length)) {
                              _context5.next = 30;
                              break;
                            }

                            if (Object.keys(message.params).length) {
                              _context5.next = 27;
                              break;
                            }

                            return _context5.abrupt("return", _this4.emit(message.notification));

                          case 27:
                            args = [message.notification];
                            if (message.params.constructor === Object) args.push(message.params);else // using for-loop instead of unshift/spread because performance is better
                              for (i = 0; i < message.params.length; i++) {
                                args.push(message.params[i]);
                              } // run as microtask so that pending queue messages are resolved first
                            // eslint-disable-next-line prefer-spread

                            return _context5.abrupt("return", Promise.resolve().then(function () {
                              _this4.emit.apply(_this4, args);
                            }));

                          case 30:
                            if (_this4.queue[message.id]) {
                              _context5.next = 34;
                              break;
                            }

                            if (!(message.method && message.params)) {
                              _context5.next = 33;
                              break;
                            }

                            return _context5.abrupt("return", Promise.resolve().then(function () {
                              _this4.emit(message.method, message.params);
                            }));

                          case 33:
                            return _context5.abrupt("return");

                          case 34:
                            // reject early since server's response is invalid
                            if ("error" in message === "result" in message) _this4.queue[message.id].promise[1](new Error("Server response malformed. Response must include either \"result\"" + " or \"error\", but not both."));
                            if (_this4.queue[message.id].timeout) clearTimeout(_this4.queue[message.id].timeout);

                            if (message.error) {
                              Object.defineProperty(message.error, "__request_id", {
                                value: message.id
                              });

                              _this4.queue[message.id].promise[1](message.error);
                            } else {
                              result = message.result;

                              if (result) {
                                result = Object.defineProperty(Object(result), "__request_id", {
                                  value: message.id
                                });
                              }

                              _this4.queue[message.id].promise[0](result);
                            }

                            _this4.queue[message.id] = null;

                          case 38:
                          case "end":
                            return _context5.stop();
                        }
                      }
                    }, _callee5, null, [[1, 20]]);
                  }));

                  return function (_x6) {
                    return _ref2.apply(this, arguments);
                  };
                }());
                this.socket.addEventListener("error", function (error) {
                  return _this4.emit("error", error);
                });
                this.socket.addEventListener("close", function (_ref3) {
                  var code = _ref3.code,
                      reason = _ref3.reason;
                  if (_this4.ready) // Delay close event until internal state is updated
                    setTimeout(function () {
                      return _this4.emit("close", code, reason);
                    }, 0);
                  _this4.ready = false;
                  _this4.socket = undefined;
                  if (code === 1000) return;
                  _this4.current_reconnects++;
                  if (_this4.reconnect && (_this4.max_reconnects > _this4.current_reconnects || _this4.max_reconnects === 0)) setTimeout(function () {
                    return _this4._connect(address, options);
                  }, _this4.reconnect_interval);
                });

              case 7:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function _connect(_x4, _x5) {
        return _connect2.apply(this, arguments);
      }

      return _connect;
    }()
  }]);
  return CommonClient;
}(_eventemitter.EventEmitter);

exports["default"] = CommonClient;