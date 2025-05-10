// 全局变量
const translations = window.translations || {};
const currentLang = window.currentLang || 'en';
let allKeys = [];
let currentPage = 1;
let pageSize = 12;
let authToken = localStorage.getItem("guestToken") || "";
let accessControlMode = "open";

// DOM元素
const keysContainer = document.getElementById("keys-container");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageInfo = document.getElementById("page-info");
const totalCountEl = document.getElementById("total-count");
const validCountEl = document.getElementById("valid-count");
const totalBalanceEl = document.getElementById("total-balance");
const toast = document.getElementById("toast");

// API按钮和弹窗
const floatApiBtn = document.getElementById("floatApiBtn");
const apiModal = document.getElementById("apiModal");
const apiModalClose = document.getElementById("apiModalClose");

// 显示API弹窗
floatApiBtn.addEventListener("click", () => {
    apiModal.classList.add("show");
    document.body.style.overflow = "hidden"; // 防止背景滚动

    // 添加媒体查询适配动画
    if (window.innerWidth <= 768) {
        document.querySelector(".api-modal-content").style.transform = "translateY(0)";
    }
});

// 关闭API弹窗
apiModalClose.addEventListener("click", () => {
    apiModal.classList.remove("show");
    document.body.style.overflow = ""; // 恢复滚动
});

// 点击弹窗外部关闭
apiModal.addEventListener("click", e => {
    if (e.target === apiModal) {
        apiModal.classList.remove("show");
        document.body.style.overflow = "";
    }
});

// 代码复制功能
document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", function () {
        const codeText = this.getAttribute("data-copy");

        // 使用异步剪贴板API
        navigator.clipboard
            .writeText(codeText)
            .then(() => {
                // 成功复制后的视觉反馈
                this.classList.add("copied");
                this.innerText = translations.home_js_copied_text || "Copied";

                // 恢复原始状态
                setTimeout(() => {
                    this.classList.remove("copied");
                    this.innerHTML = translations.home_js_copy_code_text || "Copy Code";
                    // If the original button had an icon/span, it should be preserved or re-added if translations don't include HTML
                    // For simplicity, assuming text-only or the translation key includes necessary HTML
                    if (!this.querySelector('span') && (translations.home_js_copy_code_text || "Copy Code").includes('span')) {
                         //This part is tricky, if the original had an icon, it might be better to store original innerHTML
                    } else if (!this.querySelector('span') && !(translations.home_js_copy_code_text || "Copy Code").includes('span')) {
                        // If no span and translation is text, this is fine.
                        // If original had a span and translation is text, the span is lost.
                        // A robust way would be to have separate elements for icon and text.
                        // For now, let's assume the translation key or original setup handles icons.
                        // A simple fallback if the original had a span and the translation doesn't:
                        // if (this.dataset.originalHTML && !this.innerHTML.includes("span")) this.innerHTML = this.dataset.originalHTML.replace(/>[^<]+</, `>${translations.home_js_copy_code_text || "Copy Code"}<`);
                        // This is getting complex for a simple replacement. Let's stick to text replacement for now.
                    }
                }, 2000);

                // 显示全局通知
                showToast(translations.home_js_code_copied_toast || "Code copied to clipboard");
            })
            .catch(err => {
                console.error("复制失败:", err);
                showToast(translations.home_js_copy_failed_toast_manual || "Copy failed, please copy manually", true);
            });
    });
});

// 从服务器加载密钥
async function loadKeys(retryCount = 3, retryDelay = 1500) {
    try {
        // 显示加载状态
        if (!keysContainer.querySelector(".loading")) {
            keysContainer.innerHTML = `
        <div class="loading">
          <div>
            <span class="loader"></span>
            <span>${translations.loading_text || 'Loading...'}</span>
          </div>
        </div>
      `;
        }

        // 构建请求头，添加认证信息
        const headers = {
            "Content-Type": "application/json"
        };
        
        // 确保从 localStorage 获取最新的 token
        authToken = localStorage.getItem("guestToken") || "";
        if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
        }

        const response = await fetch("/admin/api/keys", { headers });

        // 处理未认证的情况
        if (response.status === 401) {
            const result = await response.json();
            if (result.requireAuth) {
                // 清除失效的token
                localStorage.removeItem("guestToken");
                authToken = "";

                // 根据访问控制模式显示不同内容
                if (result.accessControl === "private") {
                    keysContainer.innerHTML =
                        `<div class="empty-state">${translations.home_js_admin_only_message || 'This page is for administrators only.<br><a href="/admin" style="color: #3498db;">Go to Admin Login</a>'}</div>`;
                } else if (result.accessControl === "restricted") {
                    // 显示访客认证弹窗
                    showAuthModal();
                    // 显示需要认证的提示
                    keysContainer.innerHTML = `
              <div class="empty-state">
                <p>${translations.home_js_guest_password_required || 'Guest password required to view content'}</p>
                <button id="show-auth-button" style="margin-top: 20px; background: #3498db; color: white; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
                  ${translations.home_js_click_to_authenticate || 'Click to Authenticate'}
                </button>
              </div>
            `;
                    // 添加认证按钮点击事件
                    setTimeout(() => {
                        const authButton = document.getElementById("show-auth-button");
                        if (authButton) {
                            authButton.addEventListener("click", showAuthModal);
                        }
                    }, 0);
                }
                return;
            }
        }

        if (!response.ok) {
            throw new Error(`${translations.home_js_server_error_prefix || 'Server response error: '}${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            allKeys = result.data;
            pageSize = await getPageSize();
            renderKeys();
            updateCountsWithAnimation();
        } else {
            throw new Error(result.message || (translations.home_js_load_keys_failed || "Failed to load keys"));
        }
    } catch (error) {
        console.error("加载密钥时出错:", error);

        if (retryCount > 0) {
            // 显示重试消息
            keysContainer.innerHTML = `
        <div class="empty-state">
          <p>${translations.home_js_load_failed_prefix || 'Load failed: '}${error.message}</p>
          <p>${translations.home_js_retrying_prefix || 'Retrying... ('}${retryCount}${translations.home_js_retrying_suffix || ' attempts left)'}</p>
          <div class="loader" style="display: inline-block; margin-top: 10px; border-top-color: #3498db;"></div>
        </div>
      `;

            // 延迟后重试
            setTimeout(() => loadKeys(retryCount - 1, retryDelay * 1.5), retryDelay);
        } else {
            // 所有重试都失败了，显示最终错误并提供刷新按钮
            keysContainer.innerHTML = `
        <div class="empty-state">
          <p>${translations.home_js_load_failed_prefix || 'Load failed: '}${error.message}</p>
          <button id="retry-button" style="margin-top: 15px; background: #3498db; color: white; border: none; border-radius: 4px; padding: 10px 20px; cursor: pointer;">
            ${translations.home_js_refresh_retry_button || 'Refresh and Retry'}
          </button>
        </div>
      `;

            // 为刷新按钮添加事件监听器
            setTimeout(() => {
                const retryButton = document.getElementById("retry-button");
                if (retryButton) {
                    retryButton.addEventListener("click", () => {
                        // 显示加载状态
                        keysContainer.innerHTML = `
              <div class="loading">
                <div>
                  <span class="loader"></span>
                  <span>${translations.loading_text || 'Loading...'}</span>
                </div>
              </div>
            `;

                        // 短暂延迟后重新加载
                        setTimeout(() => loadKeys(3, 1500), 300);
                    });
                }
            }, 0);
        }
    }
}

// 获取页面大小配置
async function getPageSize(retryCount = 2) {
    try {
        const response = await fetch("/admin/api/pageSize");
        if (!response.ok) {
            throw new Error(`${translations.home_js_server_error_prefix || 'Server response error: '}${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            return parseInt(result.data) || 12; // 确保有默认值
        } else {
            throw new Error(result.message || (translations.home_js_get_page_config_failed || "Failed to get page configuration"));
        }
    } catch (error) {
        console.warn("加载页面大小配置时出错:", error);

        // 尝试重试
        if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟1秒
            return getPageSize(retryCount - 1);
        }

        // 返回默认值
        return 12;
    }
}

// 渲染当前页面的密钥
function renderKeys() {
    // 格式化日期
    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            // 检查日期是否有效
            if (isNaN(date.getTime())) {
                return translations.home_js_time_unknown || "Time unknown";
            }
            // 指定使用24小时制格式
            const localeForDate = currentLang === 'tr' ? 'tr-TR' : (currentLang === 'en' ? 'en-US' : 'zh-CN');
            return date.toLocaleString(localeForDate, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false, // 使用24小时制
            });
        } catch (e) {
            console.error("日期格式化错误:", e);
            return translations.home_js_time_unknown || "Time unknown";
        }
    }

    if (allKeys.length === 0) {
        keysContainer.innerHTML = `<div class="empty-state">${translations.home_js_no_api_keys || 'No API Keys available'}</div>`;
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        pageInfo.textContent = `${translations.page_info_prefix || 'Page'} 0${translations.page_info_suffix || ''}`;
        return;
    }

    // 按余额从高到低排序
    const sortedKeys = [...allKeys].sort((a, b) => {
        // 转换为数字进行比较，确保是数值比较
        const balanceA = parseFloat(a.balance) || 0;
        const balanceB = parseFloat(b.balance) || 0;
        return balanceB - balanceA; // 从高到低排序
    });

    // 计算分页
    const totalPages = Math.ceil(sortedKeys.length / pageSize);
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, sortedKeys.length);
    const currentKeys = sortedKeys.slice(startIndex, endIndex);

    // 更新分页控件
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    pageInfo.textContent = `${translations.page_info_prefix || 'Page'} ${currentPage}${translations.home_js_page_info_middle || ' / '}${totalPages}${translations.page_info_suffix || ''}`;

    // 渲染密钥
    let html = "";
    for (const keyObj of currentKeys) {
        // 省略显示密钥：保留前10位和后5位，中间用...替代
        const displayKey =
            keyObj.key.length > 20
                ? `${keyObj.key.substring(0, 10)}...${keyObj.key.substring(keyObj.key.length - 5)}`
                : keyObj.key;

        // 根据余额确定类名和显示文本
        let balanceClass = "";
        let balanceText = "";
        const balance = parseFloat(keyObj.balance) || 0;

        if (balance <= 0) {
            balanceClass = "zero";
            balanceText = translations.home_js_balance_invalid || "Invalid";
        } else if (balance > 0 && balance <= 7) {
            balanceClass = "low";
            balanceText = balance;
        } else if (balance > 7 && balance <= 14) {
            balanceClass = "normal";
            balanceText = balance;
        } else if (balance > 14 && balance <= 100) {
            balanceClass = "medium";
            balanceText = balance;
        } else if (balance > 100) {
            balanceClass = "high";
            balanceText = balance;
        }

        html += `
        <div class="key-item" onclick="copyKey('${keyObj.key}')" title="${keyObj.key}">
            <div class="key-text">${displayKey}</div>
            <div class="key-balance ${balanceClass}">${balanceText}</div>
            <div class="key-update-time">
              ${keyObj.lastUpdated ? (translations.home_js_updated_at_prefix || 'Updated at ') + formatDate(keyObj.lastUpdated) : (translations.home_js_not_updated || 'Not updated')}
            </div>
        </div>
      `;
    }

    keysContainer.innerHTML = html;
}

// 更新计数显示
function updateCountsWithAnimation() {
    // 获取实际数据
    const total = allKeys.length;
    const valid = allKeys.filter(k => k.balance > 0).length;
    const totalBalance = allKeys
        .reduce((sum, key) => {
            return sum + (parseFloat(key.balance) || 0);
        }, 0)
        .toFixed(2);

    // 为三个数字添加动画
    animateCounter(totalCountEl, total);
    animateCounter(validCountEl, valid);
    animateCounter(document.getElementById("total-balance"), totalBalance, "￥", true);
}

// 页面加载时初始化数字显示样式
document.addEventListener("DOMContentLoaded", () => {
    // 确保初始状态为红色小字体
    const countValues = document.querySelectorAll(".count-value");
    countValues.forEach(el => {
        el.style.fontSize = "1.5rem";
        el.style.fontWeight = "600";
        el.style.color = "#e74c3c";
    });

    // 初始加载时首先检查访问控制状态，而不是直接加载密钥
    checkAccessControl();

    // 访客验证按钮事件
    document.getElementById("verify-guest-btn").addEventListener("click", verifyGuestPassword);

    // 关闭认证弹窗按钮
    document.getElementById("authModalClose").addEventListener("click", () => {
        document.getElementById("auth-modal").classList.remove("show");

        // 如果是受限模式且没有token，确保显示认证按钮
        if (accessControlMode === "restricted" && !authToken) {
            keysContainer.innerHTML = `
        <div class="empty-state">
          <p>需要访客密码才能查看内容</p>
          <button id="show-auth-button" style="margin-top: 20px; background: #3498db; color: white; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
            点击认证
          </button>
        </div>
      `;

            // 添加认证按钮点击事件
            setTimeout(() => {
                const authButton = document.getElementById("show-auth-button");
                if (authButton) {
                    authButton.addEventListener("click", showAuthModal);
                }
            }, 0);
        }
    });

    // 密码输入框回车事件
    document.getElementById("guest-password").addEventListener("keypress", e => {
        if (e.key === "Enter") {
            verifyGuestPassword();
        }
    });
});

// 数字动画函数
function animateCounter(element, targetValue, prefix = "", isBalance = false) {
    // 确保目标是数字
    const target = parseFloat(targetValue) || 0;
    const isInteger = !isBalance && Number.isInteger(target);
    let current = 0;

    // 动画持续时间和帧率
    const duration = 5000; // 5秒动画
    const framesPerSecond = 60;
    const frames = (duration / 1000) * framesPerSecond;

    // 使用easeOutExpo缓动函数以获得非线性的动画效果
    const easeOutExpo = t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    // 停止现有的动画
    if (element._animationFrame) {
        cancelAnimationFrame(element._animationFrame);
    }

    const startTime = performance.now();

    // 动画函数
    const animate = timestamp => {
        // 计算已经过去的时间比例
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用缓动函数
        const easedProgress = easeOutExpo(progress);

        // 计算当前值
        current = easedProgress * target;

        // 格式化
        let displayValue = prefix;
        if (isInteger) {
            displayValue += Math.round(current);
        } else if (isBalance) {
            displayValue += current.toFixed(2);
        } else {
            displayValue += Math.round(current * 100) / 100;
        }

        // 根据数值大小设置样式
        const numValue = parseFloat(current);

        // 计算字体大小: 1-9: 1.5rem, 10-99: 1.8rem, 100-999: 2.2rem, 1000+: 2.8rem
        let fontSize = "1.5rem";
        if (numValue >= 1000) {
            fontSize = "2.8rem";
        } else if (numValue >= 100) {
            fontSize = "2.2rem";
        } else if (numValue >= 10) {
            fontSize = "1.8rem";
        }

        // 计算颜色: 个位数红色, 十位数黑色, 百位数绿色, 千位数及以上彩色
        let color = "#e74c3c"; // 红色(个位数)

        if (numValue >= 1000) {
            // 千位数及以上: 渐变彩色
            const hue = numValue % 360 || 50;
            color = `linear-gradient(135deg, purple, #3498db, #f39c12)`;
            element.style.webkitBackgroundClip = "text";
            element.style.backgroundClip = "text";
            element.style.color = "transparent";
            element.style.backgroundImage = color;
            element.style.textShadow = "0 0 8px rgba(255,255,255,0.6)";
        } else if (numValue >= 120) {
            // 120以上: 完全绿色
            color = "#27ae60";
            element.style.backgroundImage = "none";
            element.style.color = color;
            element.style.textShadow = "none";
        } else if (numValue >= 80) {
            // 80-120: 从黑到绿的渐变 - 压缩到这个区间
            const greenIntensity = Math.min((numValue - 80) / 40, 1); // 40是区间宽度(120-80)
            const red = Math.round(44 - 44 * greenIntensity); // 44->0
            const green = Math.round(44 + 130 * greenIntensity); // 44->174
            const blue = Math.round(80 - 20 * greenIntensity); // 80->60
            color = `rgb(${red}, ${green}, ${blue})`;
            element.style.backgroundImage = "none";
            element.style.color = color;
            element.style.textShadow = "none";
        } else if (numValue >= 10) {
            // 十位数: 从红到黑的渐变
            const blackIntensity = Math.min((numValue - 10) / 70, 1); // 压缩到10-80区间
            const red = Math.round(231 - (231 - 44) * blackIntensity);
            const green = Math.round(76 - (76 - 44) * blackIntensity);
            const blue = Math.round(60 - (60 - 80) * blackIntensity);
            color = `rgb(${red}, ${green}, ${blue})`;
            element.style.backgroundImage = "none";
            element.style.color = color;
            element.style.textShadow = "none";
        } else {
            // 个位数: 红色
            element.style.backgroundImage = "none";
            element.style.color = "#e74c3c";
            element.style.textShadow = "none";
        }

        // 应用样式
        element.style.fontSize = fontSize;
        element.style.fontWeight = numValue >= 100 ? "700" : "600";
        element.style.transition = "all 0.2s ease";

        // 更新显示的值
        element.textContent = displayValue;

        // 判断是否继续动画
        if (progress < 1) {
            element._animationFrame = requestAnimationFrame(animate);
        }
    };

    // 启动动画
    element._animationFrame = requestAnimationFrame(animate);
}

// 将密钥复制到剪贴板
function copyKey(key) {
    navigator.clipboard
        .writeText(key)
        .then(() => {
            // 找到被点击的元素
            const elements = document.querySelectorAll(".key-item");
            let targetElement;

            elements.forEach(el => {
                if (el.getAttribute("title") === key) {
                    targetElement = el;
                }
            });

            if (targetElement) {
                // 添加复制成功动画类
                targetElement.classList.add("copy-success");

                // 显示通知
                showToast(translations.home_js_code_copied_toast || "Code copied to clipboard");

                // 一段时间后移除动画类
                setTimeout(() => {
                    targetElement.classList.remove("copy-success");
                }, 1500);
            } else {
                showToast(translations.home_js_code_copied_toast || "Code copied to clipboard");
            }
        })
        .catch(err => {
            console.error("复制失败: ", err);
            showToast(translations.home_js_copy_failed_toast || "Copy failed", true);
        });
}

// 显示通知消息
function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.background = isError ? "rgba(231, 76, 60, 0.95)" : "rgba(46, 204, 113, 0.95)";

    // 添加/移除错误类以显示正确的图标
    if (isError) {
        toast.classList.add("error");
    } else {
        toast.classList.remove("error");
    }

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// 显示错误消息
function showError(message) {
    keysContainer.innerHTML = `<div class="empty-state">${message}</div>`;
}

// 处理分页
prevPageBtn.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        renderKeys();
    }
});

nextPageBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(allKeys.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderKeys();
    }
});

// 检查访问控制状态
async function checkAccessControl() {
    try {
        // 显示正在检查权限的状态
        keysContainer.innerHTML = `
      <div class="loading">
        <div>
          <span class="loader"></span>
          <span>${translations.home_js_checking_access || 'Checking access permissions...'}</span>
        </div>
      </div>
    `;

        const response = await fetch("/admin/api/access-control");
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                accessControlMode = data.data.accessControl;

                // 根据访问控制模式执行不同操作
                if (accessControlMode === "open") {
                    // 完全开放，直接加载
                    loadKeys();
                } else if (accessControlMode === "private") {
                    // 完全私有，显示管理员登录
                    keysContainer.innerHTML =
                        '<div class="empty-state">此页面仅限管理员访问<br><a href="/admin" style="color: #3498db;">前往管理员登录</a></div>';
                } else if (accessControlMode === "restricted") {
                    // 部分开放，检查是否已有token
                    authToken = localStorage.getItem("guestToken") || "";
                    if (authToken) {
                        // 尝试使用现有token加载
                        loadKeys();
                    } else {
                        // 显示访客认证弹窗
                        showAuthModal();
                        // 清空加载中显示，同时添加一个认证按钮
                        keysContainer.innerHTML = `
              <div class="empty-state">
                <p>${translations.home_js_enter_guest_password_prompt || 'Please enter guest password to continue'}</p>
                <button id="show-auth-button" style="margin-top: 20px; background: #3498db; color: white; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer; font-size: 14px; transition: all 0.3s ease;">
                  ${translations.home_js_click_to_authenticate || 'Click to Authenticate'}
                </button>
              </div>
            `;

                        // 添加认证按钮的点击事件监听器
                        setTimeout(() => {
                            const authButton = document.getElementById("show-auth-button");
                            if (authButton) {
                                authButton.addEventListener("click", showAuthModal);
                            }
                        }, 0);
                    }
                }
            }
        }
    } catch (error) {
        console.error("检查访问控制状态时出错:", error);
        showToast(translations.home_js_get_access_status_failed || "Failed to get page access status", true);
        // 显示错误信息
        keysContainer.innerHTML =
            `<div class="empty-state">${translations.home_js_get_access_control_failed_message || 'Failed to get access control status.<br>Please refresh the page to try again.'}</div>`;
    }
}

// 显示认证弹窗
function showAuthModal() {
    const authModal = document.getElementById("auth-modal");
    authModal.classList.add("show");

    // 聚焦到密码输入框
    setTimeout(() => {
        document.getElementById("guest-password").focus();
    }, 300);
}

// 验证访客密码
async function verifyGuestPassword() {
    const passwordInput = document.getElementById("guest-password");
    const password = passwordInput.value.trim();
    const errorMsg = document.getElementById("auth-error");

    if (!password) {
        errorMsg.textContent = translations.home_js_auth_enter_password_error || "Please enter password";
        errorMsg.style.display = "block";
        return;
    }

    try {
        // 添加加载状态
        const verifyBtn = document.getElementById("verify-guest-btn");
        const originalBtnText = verifyBtn.textContent; // Should be translations.auth_modal_submit
        verifyBtn.disabled = true;
        verifyBtn.textContent = translations.home_js_auth_verifying_button || "Verifying...";
        
        const response = await fetch("/admin/api/verify-guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (data.success) {
            // 认证成功，保存token并加载密钥
            authToken = data.token;
            localStorage.setItem("guestToken", authToken);
            // 显示一个成功消息
            showToast(translations.home_js_auth_success_toast || "Guest authentication successful", false);
            // 关闭弹窗
            document.getElementById("auth-modal").classList.remove("show");
            // 重置输入和错误信息
            passwordInput.value = "";
            errorMsg.style.display = "none";
            // 加载密钥数据
            loadKeys();
        } else {
            // 认证失败
            errorMsg.textContent = data.message || (translations.auth_modal_error || "Incorrect password, please try again."); // Using existing key if applicable
            errorMsg.style.display = "block";
            passwordInput.focus();
        }
        
        // 恢复按钮状态
        verifyBtn.disabled = false;
        verifyBtn.textContent = translations.auth_modal_submit || "Verify"; // Use original translated text
    } catch (error) {
        console.error("验证访客密码时出错:", error);
        errorMsg.textContent = translations.home_js_auth_verify_failed_error || "Verification failed, please try again";
        errorMsg.style.display = "block";
        
        // 恢复按钮状态
        const verifyBtn = document.getElementById("verify-guest-btn");
        verifyBtn.disabled = false;
        verifyBtn.textContent = translations.auth_modal_submit || "Verify"; // Use original translated text
    }
}
