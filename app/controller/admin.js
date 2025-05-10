"use strict";

const { Controller } = require("egg");
const fs = require("fs").promises;
const path = require("path");

class AdminController extends Controller {
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
        await ctx.render("admin.html", { translations, lang, config });
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

        if (!key) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: "Key is required",
            };
            return;
        }

        await ctx.service.key.addKey(key, balance);
        ctx.body = { success: true };
    }

    async addKeysBulk() {
        const { ctx } = this;
        const { keys } = ctx.request.body;

        if (!keys) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: "Keys are required",
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

        if (!key) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: "Key is required",
            };
            return;
        }

        await ctx.service.key.deleteKey(key);
        ctx.body = { success: true };
    }

    async updateKeyBalance() {
        const { ctx } = this;
        const { key } = ctx.request.body;

        if (!key) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: "密钥不能为空",
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

        if (!keys || !Array.isArray(keys) || keys.length === 0) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: "请提供要检测的密钥列表",
            };
            return;
        }

        const now = new Date().toISOString();
        const results = [];

        for (const key of keys) {
            try {
                const result = await ctx.service.proxy.checkKeyValidity(key);
                await ctx.service.key.updateKeyBalance(
                    key,
                    result.balance,
                    result.isValid ? null : result.message
                );

                results.push({
                    key,
                    success: true,
                    isValid: result.isValid,
                    balance: result.balance,
                    lastUpdated: now,
                    message: result.message,
                });
            } catch (error) {
                results.push({
                    key,
                    success: false,
                    isValid: false,
                    balance: 0,
                    lastUpdated: now,
                    message: `检测失败: ${error.message || "未知错误"}`,
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
        const { results } = ctx.request.body;

        if (!results || !Array.isArray(results) || results.length === 0) {
            ctx.status = 400;
            ctx.body = {
                success: false,
                message: "请提供要更新的密钥结果列表",
            };
            return;
        }

        const now = new Date().toISOString();
        const updateResults = [];

        for (const result of results) {
            try {
                if (!result.key) {
                    updateResults.push({
                        success: false,
                        message: "密钥不能为空",
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
                    key: result.key || "未知密钥",
                    success: false,
                    message: `处理更新失败: ${error.message || "未知错误"}`,
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

        if (!keys || !Array.isArray(keys) || keys.length === 0) {
            ctx.status = 400;
            ctx.body = { success: false, message: "请提供要删除的密钥列表" };
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
