import http from "http";

export interface IHttpServer {
    stop();
    start();
    onUpgrade(listener: (...args: any[]) => void): IHttpServer;
}

export class HttpServer implements IHttpServer {
    httpServer: http.Server;
    private port: number;

    constructor(port: number) {
        this.port = port;

        this.httpServer = http.createServer();
    }

    onUpgrade(listener: (...args: any[]) => void): IHttpServer {
        this.httpServer.on('upgrade', listener);

        return this;
    }

    start(): IHttpServer {
        this.httpServer.listen(this.port);
        console.log(`server listening on port: ${this.port}`)
        return this;
    }

    stop() {
        this.httpServer.close();
        console.log("server stopped");
    }
}