"use strict";

const { Controller } = require("egg");
const fs = require("fs").promises;
const path = require("path");

class HomeController extends Controller {
    async index() {
        const { ctx } = this;
        const appConfig = await ctx.service.config.get();
        // Allow language override from query parameter
        const currentLang = ctx.query.lang || appConfig.language || "en"; 
        const translationsPath = path.join(ctx.app.baseDir, "app", "locales", `${currentLang}.json`);
        let translations = {};
        try {
            const fileContent = await fs.readFile(translationsPath, "utf-8");
            translations = JSON.parse(fileContent);
        } catch (error) {
            ctx.logger.error(`Failed to load translations for ${currentLang}:`, error);
            // Fallback to English if the selected language file is not found or corrupted
            if (currentLang !== "en") {
                const fallbackPath = path.join(ctx.app.baseDir, "app", "locales", "en.json");
                try {
                    const fallbackContent = await fs.readFile(fallbackPath, "utf-8");
                    translations = JSON.parse(fallbackContent);
                    // Set currentLang to 'en' if fallback is used
                    // currentLang = "en"; // This line was commented out as it might be confusing if query.lang was specific
                } catch (fallbackError) {
                    ctx.logger.error("Failed to load fallback English translations:", fallbackError);
                }
            }
        }
        await ctx.render("home.html", { translations, currentLang });
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
            // Attempt to load translations for error messages
            const appConfig = await ctx.service.config.get();
            const currentLang = ctx.query.lang || appConfig.language || "en";
            let translations = {};
            try {
                const translationsPath = path.join(ctx.app.baseDir, "app", "locales", `${currentLang}.json`);
                const fileContent = await fs.readFile(translationsPath, "utf-8");
                translations = JSON.parse(fileContent);
            } catch (e) {
                ctx.logger.error(`Failed to load translations for verifyGuest error for ${currentLang}:`, e);
            }

            ctx.body = {
                success: false,
                message: translations.guest_auth_not_required || "Guest authentication is not required in the current mode.",
            };
            return;
        }

        // Verify guest password
        if (data.password === config.guest_password) {
            ctx.body = {
                success: true,
                token: config.guest_password, // Sending password as token is not ideal, but keeping existing logic
            };
        } else {
            // Attempt to load translations for error messages
            const appConfig = await ctx.service.config.get();
            const currentLang = ctx.query.lang || appConfig.language || "en";
            let translations = {};
            try {
                const translationsPath = path.join(ctx.app.baseDir, "app", "locales", `${currentLang}.json`);
                const fileContent = await fs.readFile(translationsPath, "utf-8");
                translations = JSON.parse(fileContent);
            } catch (e) {
                ctx.logger.error(`Failed to load translations for verifyGuest error for ${currentLang}:`, e);
            }
            ctx.status = 401;
            ctx.body = {
                success: false,
                message: translations.guest_password_incorrect || "Incorrect guest password.",
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
