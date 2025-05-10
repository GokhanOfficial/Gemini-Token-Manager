"use strict";

const { Controller } = require("egg");
const fs = require("fs").promises;
const path = require("path");

class AdminController extends Controller {
    async _loadTranslations(ctx) {
        const appConfig = await ctx.service.config.get();
        const currentLang = ctx.query.lang || appConfig.language || "en";
        const translationsPath = path.join(ctx.app.baseDir, "app", "locales", `${currentLang}.json`);
        let translations = {};
        try {
            const fileContent = await fs.readFile(translationsPath, "utf-8");
            translations = JSON.parse(fileContent);
        } catch (error) {
            ctx.logger.error(`Failed to load translations for ${currentLang}:`, error);
            if (currentLang !== "en") {
                const fallbackPath = path.join(ctx.app.baseDir, "app", "locales", "en.json");
                try {
                    const fallbackContent = await fs.readFile(fallbackPath, "utf-8");
                    translations = JSON.parse(fallbackContent);
                } catch (fallbackError) {
                    ctx.logger.error("Failed to load fallback English translations:", fallbackError);
                }
            }
        }
        return translations;
    }

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
                    // currentLang = "en"; // This line was commented out as it might be confusing if query.lang was specific
                } catch (fallbackError) {
                    ctx.logger.error("Failed to load fallback English translations:", fallbackError);
                }
            }
        }
        await ctx.render("admin.html", { translations, currentLang, config: appConfig });
    }

    async getConfig() {
        const { ctx } = this;
        const config = await ctx.service.config.get();
        ctx.body = {
            success: true,
            data: config,
        };
    }

    async updateConfig() {
        const { ctx } = this;
        const data = ctx.request.body;
        const result = await ctx.service.config.updateConfig(data);
        ctx.body = {
            success: true,
            data: result,
        };
    }

    async addKey() {
        const { ctx } = this;
        const { key, balance = 0 } = ctx.request.body;
        const translations = await this._loadTranslations(ctx);

        if (!key) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: translations.admin_api_key_is_required || "Key is required",
            };
            return;
        }

        await ctx.service.key.addKey(key, balance);
        ctx.body = { success: true };
    }

    async addKeysBulk() {
        const { ctx } = this;
        const { keys } = ctx.request.body;
        const translations = await this._loadTranslations(ctx);

        if (!keys) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: translations.admin_api_keys_are_required || "Keys are required",
            };
            return;
        }

        const keyList = keys.map(k => k.trim()).filter(k => k);

        const addedKeys = await ctx.service.key.addKeys(keyList, 0);

        ctx.body = {
            success: true,
            count: addedKeys.length,
            addedKeys: addedKeys.length,
            keyList,
            autoCheck: true,
        };
    }

    async deleteKey() {
        const { ctx } = this;
        const { key } = ctx.request.body;
        const translations = await this._loadTranslations(ctx);

        if (!key) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: translations.admin_api_key_is_required || "Key is required",
            };
            return;
        }

        await ctx.service.key.deleteKey(key);
        ctx.body = { success: true };
    }

    async updateKeyBalance() {
        const { ctx } = this;
        const { key } = ctx.request.body;
        const translations = await this._loadTranslations(ctx);

        if (!key) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: translations.admin_api_key_cannot_be_empty || "Key cannot be empty",
            };
            return;
        }

        const result = await ctx.service.proxy.checkKeyValidity(key);
        const now = new Date().toISOString();

        await ctx.service.key.updateKeyBalance(
            key,
            result.balance,
            result.isValid ? null : result.message
        );

        ctx.body = {
            success: result.isValid,
            balance: result.balance,
            message: result.message,
            key,
            isValid: result.isValid,
            lastUpdated: now,
        };
    }

    async updateKeysBalance() {
        const { ctx } = this;
        const { keys } = ctx.request.body;
        const translations = await this._loadTranslations(ctx);

        if (!keys || !Array.isArray(keys) || keys.length === 0) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: translations.admin_api_provide_keys_to_detect || "Please provide a list of keys to detect",
            };
            return;
        }

        const now = new Date().toISOString();
        const results = [];

        for (const key_item of keys) { // renamed key to key_item to avoid conflict with translations.key
            try {
                const result = await ctx.service.proxy.checkKeyValidity(key_item);
                await ctx.service.key.updateKeyBalance(
                    key_item,
                    result.balance,
                    result.isValid ? null : result.message
                );

                results.push({
                    key: key_item,
                    success: true,
                    isValid: result.isValid,
                    balance: result.balance,
                    lastUpdated: now,
                    message: result.message,
                });
            } catch (error) {
                results.push({
                    key: key_item,
                    success: false,
                    isValid: false,
                    balance: 0,
                    lastUpdated: now,
                    message: `${translations.admin_api_detection_failed || "Detection failed: "}${error.message || translations.admin_api_unknown_error || "Unknown error"}`,
                });
            }
        }

        ctx.body = {
            success: true,
            results,
            count: results.length,
            validCount: results.filter(r => r.isValid).length,
        };
    }

    async batchUpdateKeys() {
        const { ctx } = this;
        const { results: batchResults } = ctx.request.body; // Renamed results to batchResults
        const translations = await this._loadTranslations(ctx);

        if (!batchResults || !Array.isArray(batchResults) || batchResults.length === 0) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: translations.admin_api_provide_key_results_to_update || "Please provide a list of key results to update",
            };
            return;
        }

        const now = new Date().toISOString();
        const updateResults = [];

        for (const result of batchResults) {
            try {
                if (!result.key) {
                    updateResults.push({
                        success: false,
                        message: translations.admin_api_key_cannot_be_empty || "Key cannot be empty",
                    });
                    continue;
                }

                await ctx.service.key.updateKeyBalance(result.key, result.balance || 0);

                updateResults.push({
                    key: result.key,
                    success: true,
                    updated: now,
                });
            } catch (error) {
                updateResults.push({
                    key: result.key || translations.admin_api_unknown_key || "Unknown key",
                    success: false,
                    message: `${translations.admin_api_processing_update_failed || "Processing update failed: "}${error.message || translations.admin_api_unknown_error || "Unknown error"}`,
                });
            }
        }

        const successCount = updateResults.filter(r => r.success).length;

        ctx.body = {
            success: true,
            updated: successCount,
            failed: updateResults.length - successCount,
            total: updateResults.length,
            results: updateResults,
        };
    }

    // 在 AdminController 类中添加
    async deleteKeys() {
        const { ctx } = this;
        const { keys } = ctx.request.body;
        const translations = await this._loadTranslations(ctx);

        if (!keys || !Array.isArray(keys) || keys.length === 0) {
            ctx.status = 400;
            ctx.body = { success: false, message: translations.admin_api_provide_keys_to_delete || "Please provide a list of keys to delete" };
            return;
        }

        let deleted = 0;
        for (const key of keys) {
            try {
                await ctx.service.key.deleteKey(key);
                deleted++;
            } catch (error) {
                // 记录错误但继续处理
                ctx.logger.error(`删除密钥 ${key} 失败: ${error.message}`);
            }
        }

        ctx.body = { success: true, deleted };
    }

    async clearInvalidKeys() {
        const { ctx } = this;

        // 获取所有密钥
        const keys = await ctx.service.key.getAllKeys();
        // 筛选出无效密钥
        const invalidKeys = keys.filter(k => k.balance <= 0 || k.lastError);
        // 删除无效密钥
        let deleted = 0;
        for (const key of invalidKeys) {
            try {
                await ctx.service.key.deleteKey(key.key);
                deleted++;
            } catch (error) {
                ctx.logger.error(`删除无效密钥 ${key.key} 失败: ${error.message}`);
            }
        }

        ctx.body = { success: true, deleted };
    }
}

module.exports = AdminController;
