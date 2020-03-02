import { IHttpServer, HttpServer } from "./HttpServer";

export interface IHttpServerFactory {
    createInstance(): IHttpServer;
}

export class HttpServerFactory implements IHttpServerFactory {
    public createInstance(): IHttpServer {
        return new HttpServer();
    }
}