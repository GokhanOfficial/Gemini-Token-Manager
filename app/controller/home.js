"use strict";

const { Controller } = require("egg");
const fs = require("fs").promises;
const path = require("path");

class HomeController extends Controller {
    async index() {
        const { ctx } = this;
        const config = await ctx.service.config.get();
        const lang = config.language || "en";
        const translationsPath = path.join(ctx.app.baseDir, "app", "locales", `${lang}.json`);
        let translations = {};
        try {
            const fileContent = await fs.readFile(translationsPath, "utf-8");
            translations = JSON.parse(fileContent);
        } catch (error) {
            ctx.logger.error(`Failed to load translations for ${lang}:`, error);
            // Fallback to English if the selected language file is not found or corrupted
            if (lang !== "en") {
                const fallbackPath = path.join(ctx.app.baseDir, "app", "locales", "en.json");
                try {
                    const fallbackContent = await fs.readFile(fallbackPath, "utf-8");
                    translations = JSON.parse(fallbackContent);
                } catch (fallbackError) {
                    ctx.logger.error("Failed to load fallback English translations:", fallbackError);
                }
            }
        }
        await ctx.render("home.html", { translations, lang });
    }

    async pageSize() {
        const { ctx } = this;
        const pageSize = parseInt(await ctx.service.config.getValue("page_size", 12));
        ctx.body = {
            success: true,
            data: pageSize,
        };
    }

    async keys() {
        const { ctx } = this;
        const keys = await ctx.service.key.getAllKeys();
        ctx.body = {
            success: true,
            data: keys,
        };
    }

    async accessControl() {
        const { ctx } = this;
        const config = await ctx.service.config.getConfig();
        ctx.body = {
            success: true,
            data: {
                accessControl: config.access_control || "open",
            },
        };
    }

    async verifyGuest() {
        const { ctx } = this;
        const data = ctx.request.body;
        const config = await ctx.service.config.getConfig();

        if (config.access_control !== "restricted") {
            ctx.body = {
                success: false,
                message: "当前模式不需要访客认证",
            };
            return;
        }

        // Verify guest password
        if (data.password === config.guest_password) {
            ctx.body = {
                success: true,
                token: config.guest_password,
            };
        } else {
            ctx.status = 401;
            ctx.body = {
                success: false,
                message: "访客密码不正确",
            };
        }
    }

    async handleOptions() {
        const { ctx } = this;

        ctx.set("Access-Control-Allow-Origin", "*");
        ctx.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        ctx.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
        ctx.set("Access-Control-Max-Age", "86400");
        ctx.set("Access-Control-Allow-Credentials", "true");

        ctx.status = 204;
        ctx.body = "";
    }
}

module.exports = HomeController;
