"use strict"

import WebSocketBrowserImpl from "./lib/client/websocket.browser"
import CommonClient from "./lib/client"
import { IWSClientAdditionalOptions } from "./lib/client/client.types"

export class Client extends CommonClient
{
    constructor(
        address: string | (() => Promise<string>) = "ws://localhost:8080",
        {
            autoconnect = true,
            reconnect = true,
            reconnect_interval = 1000,
            max_reconnects = 5,
            ...rest_options
        }: IWSClientAdditionalOptions = {},
        generate_request_id?: (method: string, params: object | Array<any>) => number
    )
    {
        super(
            WebSocketBrowserImpl,
            address,
            {
                autoconnect,
                reconnect,
                reconnect_interval,
                max_reconnects,
                ...rest_options,
            },
            generate_request_id
        )
    }
}
