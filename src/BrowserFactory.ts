import puppeteer from "puppeteer";

export interface IBrowserFactory {
    createInstance(): Promise<puppeteer.Browser>;
}

export class BrowserFactory {

    public async createInstance() {
        return puppeteer.launch({
            args: ['--v1=1', '--disable-gpu',
                '--disable-canvas-aa', // Disable antialiasing on 2d canvas
                '--disable-2d-canvas-clip-aa', // Disable antialiasing on 2d canvas clips
                '--disable-gl-drawing-for-tests', // BEST OPTION EVER! Disables GL drawing operations which produce pixel output. With this the GL output will not be correct but tests will run faster.
                '--disable-dev-shm-usage', // ???
                '--no-zygote', // wtf does that mean ?
                '--use-gl=swiftshader', // better cpu usage with --use-gl=desktop rather than --use-gl=swiftshader, still needs more testing.
                '--enable-webgl',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-first-run',
                '--disable-infobars',
                '--disable-breakpad',
                '--window-size=1280,1024', // see defaultViewport
                '--no-sandbox', // meh but better resource comsuption
                '--disable-setuid-sandbox'],
            dumpio: false,
            handleSIGINT: true,
            handleSIGTERM: true,
            headless: true,
            ignoreHTTPSErrors: true
        });
    }
}