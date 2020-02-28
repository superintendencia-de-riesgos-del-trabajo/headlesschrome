import { IHttpProxy, HttpProxy } from "./HttpProxy";

export interface IHttpProxyFactory {
    createInstance(): IHttpProxy;
}

export class HttpProxyFactory implements IHttpProxyFactory {

    createInstance(): IHttpProxy {
        return new HttpProxy();
    }
}