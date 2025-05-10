// app/service/config.js
class ConfigService {
    constructor(ctx) {
        this.ctx = ctx;
        this.storage = ctx.service.storage;
        this.configFile = "config.json";
        this.config = null;
        this.defaultConfig = {
            api_key: "linuxdo",
            admin_username: "linuxdo",
            admin_password: "linuxdo",
            page_size: 12,
            access_control: "open",
            guest_password: "linuxdo",
            http_proxy: "",
            language: "en", // Default language
        };
    }

    async loadConfig() {
        if (this.config === null) {
            const data = await this.storage.readFile(this.configFile);
            this.config = data || { ...this.defaultConfig };
        }
        return this.config;
    }

    async saveConfig() {
        await this.storage.writeFile(this.configFile, this.config);
    }

    async get() {
        await this.loadConfig();
        return {
            apiKey: this.config.api_key,
            adminUsername: this.config.admin_username,
            adminPassword: this.config.admin_password,
            pageSize: this.config.page_size,
            accessControl: this.config.access_control,
            guestPassword: this.config.guest_password,
            httpProxy: this.config.http_proxy,
            language: this.config.language,
        };
    }

    async getConfig() {
        await this.loadConfig();
        return this.config;
    }

    async getValue(key, defaultValue) {
        await this.loadConfig();
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }

    async updateConfig(newConfig) {
        await this.loadConfig();
        if (newConfig.httpProxy !== undefined) {
            this.config.http_proxy = newConfig.httpProxy;
        }
        
        if (newConfig.apiKey !== undefined) this.config.api_key = newConfig.apiKey;
        if (newConfig.adminUsername !== undefined) this.config.admin_username = newConfig.adminUsername;
        if (newConfig.adminPassword !== undefined) this.config.admin_password = newConfig.adminPassword;
        if (newConfig.pageSize !== undefined) this.config.page_size = newConfig.pageSize;
        if (newConfig.accessControl !== undefined) this.config.access_control = newConfig.accessControl;
        if (newConfig.guestPassword !== undefined) this.config.guest_password = newConfig.guestPassword;
        if (newConfig.language !== undefined) this.config.language = newConfig.language;
        
        await this.saveConfig();
        return await this.get();
    }
}

module.exports = ConfigService;
