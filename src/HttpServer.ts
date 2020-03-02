import http from "http";

export interface IHttpServer {
    stop();
    start(port:number);
    onUpgrade(listener: (...args: any[]) => void): IHttpServer;
}

export class HttpServer implements IHttpServer {
    httpServer: http.Server;

    constructor() {
        this.httpServer = http.createServer();
    }

    onUpgrade(listener: (...args: any[]) => void): IHttpServer {
        this.httpServer.on('upgrade', listener);

        return this;
    }

    start(port:number): IHttpServer {
        this.httpServer.listen(port);
        console.log(`server listening on port: ${port}`)
        return this;
    }

    stop() {
        this.httpServer.close();
        console.log("server stopped");
    }
}