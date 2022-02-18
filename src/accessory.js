module.exports = (api) => {
    api.registerAccessory('homebridge-epson-projector-web-remote', 'ProjectorSwitch', ProjectorSwitch);
};

const fetch = require('node-fetch-retry');

class ProjectorSwitch {

    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;

        this.defaults = {
            requestPath: '/cgi-bin/directsend',
            referrerPath: '/cgi-bin/webconf',
            statusPath: '/cgi-bin/json_query?jsoncallback=HDMILINK?%2001&_=',
            key: {
                on_off: '3B',
            }
        }

        this.config.referrer = `http://${this.config.ip}${this.defaults.referrerPath}`;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        // extract name from config
        this.name = config.name;

        // create a new Stateful Programmable Switch service
        this.service = new this.Service(this.Service.StatefulProgrammableSwitch, '00000088-0000-1000-8000-0026BB765291');

        this.informationService = new this.api.hap.Service.AccessoryInformation()
            .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "Lypzor")
            .setCharacteristic(this.api.hap.Characteristic.Model, "EpsonSwitch");

        // create handlers for required characteristics
        this.service.getCharacteristic(this.Characteristic.ProgrammableSwitchEvent)
            .onGet(this.getSwitchEvent.bind(this));

        this.service.getCharacteristic(this.Characteristic.ProgrammableSwitchOutputState)
            .onGet(this.getSwitchValue.bind(this))
            .onSet(this.setSwitchValue.bind(this));

    }

    /**
     * Handle requests to get the current value of the "Programmable Switch Event" characteristic
     */
    getSwitchEvent() {
        this.log.debug('Triggered GET ProgrammableSwitchEvent');

        return this.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
    }

    /**
     * Handle requests to get the current value of the "Programmable Switch Output State" characteristic
     */
    async getSwitchValue() {
        const { ip, referrer } = this.config;
        const { statusPath } = this.defaults;

        this.log.debug('Triggered GET ProgrammableSwitchOutputState');

        const timestamp = Date.now();
        const requestUrl = `http://${ip}${statusPath}${timestamp}`;

        console.log({ requestUrl, referrer });
        try {
            const result = await fetch(requestUrl, {
                headers: {
                    Referrer: referrer,
                },
            });

            const xx = await result.text();
            console.log({ xx});

            const jsonResponse = result.json();
            const status = jsonResponse.projector.feature.reply === "01" ? 1 : 0; // on

            this.log.debug(`Switch status is: ${status}`);
            console.log(result);

            return status;
        } catch (e) {
            this.log.debug(`Failed to get switch value: ${e.message}`);
        }
    }

    /**
     * Handle requests to set the "Programmable Switch Output State" characteristic
     */
    async setSwitchValue(value) {
        this.log.debug(`Triggered SET ProgrammableSwitchOutputState: ${value}`);

        const status = this.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;
        this.log.debug(`Triggered SET ProgrammableSwitchOutputState, current status is: ${status}`);

        if (status === 0) {
            await this.sendKeyCode(this.defaults.key.on_off);
        } else {
            await this.sendKeyCode(this.defaults.key.on_off);
            await this.sendKeyCode(this.defaults.key.on_off);
        }

        return;
    }

    async sendKeyCode(key) {
        const { ip, referrer } = this.config;
        const { requestPath } = this.defaults;
        const timestamp = Date.now();

        const requestUrl = `http://${ip}/${requestPath}?KEY=${key}&_=${timestamp}`;

        try {
            const result = await fetch(requestUrl, {
                headers: {
                    Referrer: referrer,
                },
                retry: 10,
                pause: 1000,
            });

            this.log.debug(`Requested key code ${key}`);

            console.log(result);
            return result;
        } catch (e) {
            this.log.debug(`Failed sending key code: ${e.message}`);
            return e;
        }
    }
    getServices() {
        return [
            this.informationService,
            this.service,
        ];
    }
}