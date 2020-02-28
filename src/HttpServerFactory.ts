import { IHttpServer, HttpServer } from "./HttpServer";

export interface IHttpServerFactory {
    createInstance(port: number): IHttpServer;
}

export class HttpServerFactory implements IHttpServerFactory {
    public createInstance(port: number): IHttpServer {
        return new HttpServer(port);
    }
}