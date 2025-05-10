// Internationalization
const translations = window.translations || {};
const currentLang = window.currentLang || 'en';

// 标签功能
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

// 弹窗功能
let modalCallback = null;
let modalInputType = "text";

// 选中key
let selectedKeys = new Set();

// 停止检测
let isBatchProcessingStopped = false;

// 排序变量
let currentSortField = "added"; // 默认按添加时间排序
let currentSortOrder = "desc"; // 默认降序(最新添加的在前面)

// 打开弹窗
function showModal(options = {}) {
    const modal = document.getElementById("custom-modal");
    const title = document.getElementById("modal-title");
    const message = document.getElementById("modal-message");
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const inputContainer = document.getElementById("modal-input-container");
    const input = document.getElementById("modal-input");

    // 设置标题
    if (options.title) {
        document.querySelector(".modal-title").textContent = options.title;
    } else {
        document.querySelector(".modal-title").textContent = translations.admin_js_modal_default_title || "Notice";
    }

    // 设置消息
    message.textContent = options.message || "";

    // 设置按钮文本
    confirmBtn.textContent = options.confirmText || (translations.admin_js_modal_default_confirm || "Confirm");
    cancelBtn.textContent = options.cancelText || (translations.admin_js_modal_default_cancel || "Cancel");

    // 设置按钮颜色
    confirmBtn.className = options.confirmClass || "";

    // 处理输入框
    if (options.input) {
        inputContainer.style.display = "block";
        input.placeholder = options.placeholder || "";
        input.value = options.value || "";
        modalInputType = options.inputType || "text";
        input.type = modalInputType;
    } else {
        inputContainer.style.display = "none";
    }

    // 显示/隐藏取消按钮
    if (options.showCancel === false) {
        cancelBtn.style.display = "none";
    } else {
        cancelBtn.style.display = "inline-block";
    }

    // 保存回调
    if (options.callback) {
        modalCallback = options.callback;
    }

    // 显示弹窗
    modal.classList.add("show");

    // 如果有输入框，聚焦它
    if (options.input) {
        setTimeout(() => input.focus(), 100);
    }
}

// 关闭弹窗
function closeModal(isCancel = true) {
    const modal = document.getElementById("custom-modal");
    modal.classList.remove("show");
    
    // 如果是取消操作且有回调，调用回调并传入false
    if (isCancel && modalCallback) {
        try {
            modalCallback(false);
        } catch (e) {
            console.error("执行取消回调出错:", e);
        }
    }
    
    // 清理回调引用，但只在取消操作后或确认操作已经处理过回调后
    if (isCancel) {
        modalCallback = null;
    }
}

// 处理弹窗确认
function handleModalConfirm() {
    const input = document.getElementById("modal-input");
    const value = input.value;
    const hasValue = input.style.display !== 'none' && input.value !== '';

    // 如果是输入框，传入输入的值；否则传入 true 表示用户确认
    const callbackValue = hasValue ? value : true;

    if (modalCallback) {
        modalCallback(callbackValue);
    } else {
        console.warn("没有找到modalCallback");
    }

    // 使用false参数调用closeModal，表示这不是取消操作
    closeModal(false);
}

// 确认对话框
function confirmDialog(message, callback, options = {}) {

    // 直接将回调传递给 showModal
    showModal({
        title: options.title || (translations.admin_js_confirm_dialog_default_title || "Confirm Action"),
        message: message,
        confirmText: options.confirmText || (translations.admin_js_modal_default_confirm || "Confirm"),
        cancelText: options.cancelText || (translations.admin_js_modal_default_cancel || "Cancel"),
        confirmClass: options.confirmClass || "danger",
        showCancel: true,
        callback: function(result) {
            if (callback) callback(result);
        }
    });
}

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        const tabId = tab.getAttribute("data-tab");

        // 更新活动标签
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        // 更新活动内容
        tabContents.forEach(content => {
            content.classList.remove("active");
            if (content.id === tabId) {
                content.classList.add("active");
            }
        });

        // 基于标签加载内容
        if (tabId === "dashboard") {
            loadDashboard();
        } else if (tabId === "keys") {
            loadAllKeys();
        } else if (tabId === "settings") {
            loadSettings();
        }
    });
});

// 通知消息
const toast = document.getElementById("toast");

function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.background = isError ? "rgba(231, 76, 60, 0.9)" : "rgba(46, 204, 113, 0.9)";
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000); // 延长显示时间
}

// 图表实例对象
let balanceDistChart, keyStatusChart, balanceTrendChart;

// 增强的仪表盘加载函数
function loadDashboard() {
    // 检查是否在仪表盘页面
    if (
        !document.getElementById("dashboard") ||
        !document.getElementById("dashboard").classList.contains("active")
    ) {
        console.warn("Current tab is not Dashboard, skipping load"); // Non-user facing, no translation needed
        return;
    }

    loadStats();
    loadRecentKeys();

    // 添加图表数据加载和渲染
    loadChartData();
}

// 加载并处理图表数据
async function loadChartData() {
    try {
        const response = await fetch("/admin/api/keys");
        if (!response.ok) throw new Error(translations.admin_js_toast_load_keys_fail_error ? translations.admin_js_toast_load_keys_fail_error.replace("{{error}}", "") : "Failed to load keys");

        const result = await response.json();
        if (result.success) {
            const keys = result.data;

            // 处理余额分布数据
            renderBalanceDistributionChart(keys);

            // 处理密钥状态数据
            renderKeyStatusChart(keys);

            // 处理余额趋势数据
            renderBalanceTrendChart(keys);

            // 更新余额统计信息
            updateBalanceStats(keys);
        }
    } catch (error) {
        console.error("加载图表数据失败:", error);
        showToast(translations.admin_js_chart_load_data_fail || "Failed to load chart data", true);
    }
}

// 渲染余额分布图表
function renderBalanceDistributionChart(keys) {
    const ctx = document.getElementById("balance-distribution-chart").getContext("2d");

    // 定义余额区间
    const ranges = [
        { min: 0, max: 10, label: "0-10" },
        { min: 10, max: 12, label: "10-12" },
        { min: 12, max: 13, label: "12-13" },
        { min: 13, max: 14, label: "13-14" },
        { min: 14, max: 100, label: "14-100" },
        { min: 100, max: 1000, label: "100-1000" },
        { min: 1000, max: Infinity, label: "1000+" },
    ];

    // 计算每个区间的密钥数量
    const distribution = ranges.map(range => {
        return keys.filter(key => {
            const balance = parseFloat(key.balance) || 0;
            return balance > range.min && balance <= range.max;
        }).length;
    });

    // 销毁旧图表
    if (balanceDistChart) {
        balanceDistChart.destroy();
    }

    // 创建新图表
    balanceDistChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ranges.map(r => r.label),
            datasets: [
                {
                    label: translations.admin_js_chart_key_count_label || "Number of Keys",
                    data: distribution,
                    backgroundColor: [
                        "rgba(52, 152, 219, 0.7)",
                        "rgba(46, 204, 113, 0.7)",
                        "rgba(155, 89, 182, 0.7)",
                        "rgba(52, 73, 94, 0.7)",
                        "rgba(22, 160, 133, 0.7)",
                        "rgba(241, 196, 15, 0.7)",
                    ],
                    borderColor: [
                        "rgba(52, 152, 219, 1)",
                        "rgba(46, 204, 113, 1)",
                        "rgba(155, 89, 182, 1)",
                        "rgba(52, 73, 94, 1)",
                        "rgba(22, 160, 133, 1)",
                        "rgba(241, 196, 15, 1)",
                    ],
                    borderWidth: 1,
                    borderRadius: 5,
                    maxBarThickness: 50,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        title: function (tooltipItems) {
                            return `${translations.admin_js_chart_balance_range_tooltip || "Balance Range: "}${tooltipItems[0].label}`;
                        },
                        label: function (context) {
                            return `${translations.admin_js_chart_count_value_keys_tooltip ? translations.admin_js_chart_count_value_keys_tooltip.replace("{{value}}", context.raw) : `Count: ${context.raw} keys`}`;
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                    },
                    title: {
                        display: true,
                        text: translations.admin_js_chart_key_count_label || "Number of Keys",
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: translations.admin_js_chart_balance_range_axis || "Balance Range",
                    },
                },
            },
        },
    });
}

// 渲染密钥状态图表
function renderKeyStatusChart(keys) {
    const ctx = document.getElementById("key-status-chart").getContext("2d");

    // 计算状态分布
    const valid = keys.filter(k => parseFloat(k.balance) > 0 && !k.lastError).length;
    const noBalance = keys.filter(k => parseFloat(k.balance) <= 0 && !k.lastError).length;
    const hasError = keys.filter(k => k.lastError).length;

    // 销毁旧图表
    if (keyStatusChart) {
        keyStatusChart.destroy();
    }

    // 创建新图表
    keyStatusChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: [
                translations.admin_js_chart_status_valid || "Valid",
                translations.admin_js_chart_status_insufficient_balance || "Insufficient Balance",
                translations.admin_js_chart_status_error || "Error"
            ],
            datasets: [
                {
                    data: [valid, noBalance, hasError],
                    backgroundColor: [
                        "rgba(46, 204, 113, 0.8)",
                        "rgba(241, 196, 15, 0.8)",
                        "rgba(231, 76, 60, 0.8)",
                    ],
                    borderColor: [
                        "rgba(46, 204, 113, 1)",
                        "rgba(241, 196, 15, 1)",
                        "rgba(231, 76, 60, 1)",
                    ],
                    borderWidth: 1,
                    hoverOffset: 4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: "circle",
                    },
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || "";
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        },
                    },
                },
            },
        },
    });
}

// 渲染余额趋势图表
function renderBalanceTrendChart(keys) {
    const ctx = document.getElementById("balance-trend-chart").getContext("2d");

    // 获取有效密钥并按余额排序
    const validKeys = keys
        .filter(k => parseFloat(k.balance) > 0)
        .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

    // 获取选定范围
    const rangeSelect = document.getElementById("trend-range");
    const range = rangeSelect ? rangeSelect.value : "20";

    // 根据范围选择数据
    let displayKeys;
    if (range === "all") {
        displayKeys = validKeys;
    } else {
        displayKeys = validKeys.slice(0, parseInt(range));
    }

    // 准备数据
    const labels = displayKeys.map((_, index) => `${(translations.api_key || "API Key")} ${index + 1}`); // Using existing "api_key" translation
    const balances = displayKeys.map(k => parseFloat(k.balance) || 0);

    // 销毁旧图表
    if (balanceTrendChart) {
        balanceTrendChart.destroy();
    }

    // 创建新图表
    balanceTrendChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: translations.admin_js_chart_balance_label || "Balance",
                    data: balances,
                    backgroundColor: balances.map(balance => {
                        if (balance >= 50) return "rgba(46, 204, 113, 0.7)"; // 高余额
                        if (balance >= 10) return "rgba(52, 152, 219, 0.7)"; // 中等余额
                        return "rgba(241, 196, 15, 0.7)"; // 低余额
                    }),
                    borderColor: balances.map(balance => {
                        if (balance >= 50) return "rgba(46, 204, 113, 1)";
                        if (balance >= 10) return "rgba(52, 152, 219, 1)";
                        return "rgba(241, 196, 15, 1)";
                    }),
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 40,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        title: function (tooltipItems) {
                            const keyIndex = tooltipItems[0].dataIndex;
                            return `${translations.admin_js_chart_key_value_tooltip ? translations.admin_js_chart_key_value_tooltip.replace("{{value}}", displayKeys[keyIndex].key) : `Key: ${displayKeys[keyIndex].key}`}`;
                        },
                        label: function (context) {
                            return `${translations.admin_js_chart_balance_label || "Balance"}: ${context.raw}`;
                        },
                        afterLabel: function (context) {
                            const keyIndex = context.dataIndex;
                            const key = displayKeys[keyIndex];
                            if (key.lastUpdated) {
                                const dateStr = new Date(key.lastUpdated).toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US');
                                return `${translations.admin_js_chart_last_updated_value_tooltip ? translations.admin_js_chart_last_updated_value_tooltip.replace("{{value}}", dateStr) : `Last Updated: ${dateStr}`}`;
                            }
                            return "";
                        },
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: translations.admin_js_chart_balance_label || "Balance",
                    },
                },
                x: {
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 20,
                    },
                    title: {
                        display: true,
                        text: translations.admin_js_chart_key_number_axis || "Key Number",
                    },
                },
            },
        },
    });

    // 添加点击事件，显示详细信息
    ctx.canvas.onclick = function (evt) {
        const points = balanceTrendChart.getElementsAtEventForMode(
            evt,
            "nearest",
            { intersect: true },
            true
        );
        if (points.length) {
            const firstPoint = points[0];
            const keyIndex = firstPoint.index;
            const key = displayKeys[keyIndex];

            // 显示详细信息
            showKeyDetail(key);
        }
    };
}

// 显示密钥详细信息
function showKeyDetail(key) {
    const addedTime = new Date(key.added).toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US');
    const lastUpdatedTime = key.lastUpdated ? new Date(key.lastUpdated).toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US') : '';

    let message = `${translations.admin_js_key_detail_balance ? translations.admin_js_key_detail_balance.replace("{{balance}}", key.balance || 0) : `Balance: ${key.balance || 0}`}\n`;
    message += `${translations.admin_js_key_detail_added_time ? translations.admin_js_key_detail_added_time.replace("{{addedTime}}", addedTime) : `Added: ${addedTime}`}`;
    if (key.lastUpdated) {
        message += `\n${translations.admin_js_key_detail_last_updated ? translations.admin_js_key_detail_last_updated.replace("{{updatedTime}}", lastUpdatedTime) : `Last Updated: ${lastUpdatedTime}`}`;
    }
    if (key.lastError) {
        message += `\n${translations.admin_js_key_detail_error ? translations.admin_js_key_detail_error.replace("{{error}}", key.lastError) : `Error: ${key.lastError}`}`;
    }

    showModal({
        title: translations.admin_js_key_detail_modal_title || "Key Details",
        message: message,
        confirmText: translations.admin_js_key_detail_copy_key_button || "Copy Key",
        callback: () => {
            navigator.clipboard
                .writeText(key.key)
                .then(() => showToast(translations.admin_js_toast_key_copied || "Key copied to clipboard"))
                .catch(() => showToast(translations.admin_js_toast_copy_failed || "Copy failed", true));
        },
    });
}

// 更新余额统计信息
function updateBalanceStats(keys) {
    // 过滤有效键（余额大于0）
    const validBalances = keys.map(k => parseFloat(k.balance) || 0).filter(balance => balance > 0);

    if (validBalances.length > 0) {
        // 计算最大值、最小值、中位数和总和
        const max = Math.max(...validBalances);
        const min = Math.min(...validBalances);
        const total = validBalances.reduce((sum, b) => sum + b, 0);

        // 计算中位数
        const sorted = [...validBalances].sort((a, b) => a - b);
        let median;
        if (sorted.length % 2 === 0) {
            // 偶数个，取中间两个值的平均
            median = (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
        } else {
            // 奇数个，取中间值
            median = sorted[Math.floor(sorted.length / 2)];
        }

        // 更新显示
        document.getElementById("max-balance").textContent = max.toFixed(2);
        document.getElementById("min-balance").textContent = min.toFixed(2);
        document.getElementById("median-balance").textContent = median.toFixed(2);
        document.getElementById("total-balance").textContent = total.toFixed(2);
    } else {
        // 没有有效数据
        document.getElementById("max-balance").textContent = "0.00";
        document.getElementById("min-balance").textContent = "0.00";
        document.getElementById("median-balance").textContent = "0.00";
        document.getElementById("total-balance").textContent = "0.00";
    }
}

async function loadStats() {
    try {
        const response = await fetch("/admin/api/keys");
        if (!response.ok) throw new Error(translations.admin_js_toast_load_keys_fail_error ? translations.admin_js_toast_load_keys_fail_error.replace("{{error}}", "") : "Failed to load keys");

        const result = await response.json();
        if (result.success) {
            const keys = result.data;

            // 计算统计数据
            const totalKeys = keys.length;
            const validKeys = keys.filter(k => k.balance > 0).length;
            const invalidKeys = totalKeys - validKeys;

            // 修正计算平均余额的方式
            const validBalances = keys
                .map(k => parseFloat(k.balance) || 0)
                .filter(balance => balance > 0);

            const avgBalance =
                validBalances.length > 0
                    ? (validBalances.reduce((a, b) => a + b, 0) / validBalances.length).toFixed(2)
                    : "0.00";

            // 更新UI
            document.getElementById("total-keys-stat").textContent = totalKeys;
            document.getElementById("valid-keys-stat").textContent = validKeys;
            document.getElementById("invalid-keys-stat").textContent = invalidKeys;
            document.getElementById("avg-balance-stat").textContent = avgBalance;
        }
    } catch (error) {
        console.error("加载统计数据时出错:", error);
        showToast(translations.admin_js_toast_load_stats_fail || "Failed to load statistics", true);
    }
}

// 事件监听器
document.addEventListener("DOMContentLoaded", () => {
    // 初始化图表范围选择器
    const rangeSelector = document.getElementById("trend-range");
    if (rangeSelector) {
        rangeSelector.addEventListener("change", function () {
            // 更新余额趋势图
            loadChartData();
        });
    }

    document.getElementById("select-all-table").addEventListener("change", function () {
        const isChecked = this.checked;
        const allCheckboxes = document.querySelectorAll(".key-checkbox");

        // 更新所有表体中的复选框状态
        allCheckboxes.forEach(checkbox => {
            // 只有当状态不一致时才更新，避免不必要的事件触发
            if (checkbox.checked !== isChecked) {
                checkbox.checked = isChecked;

                // 调用toggleKeySelection函数更新数据
                const keyValue = checkbox.closest("tr").getAttribute("data-key");
                toggleKeySelection(keyValue, isChecked);
            }
        });
    });

    // 初始化图表周期选择器
    const periodSelector = document.getElementById("chart-period");
    if (periodSelector) {
        periodSelector.addEventListener("change", function () {
            // 更新所有图表
            loadChartData();
        });
    }

    // 初始化趋势图显示切换按钮
    const trendViewToggle = document.getElementById("toggle-trend-view");
    if (trendViewToggle) {
        trendViewToggle.addEventListener("click", function () {
            // 切换异常值显示
            if (balanceTrendChart) {
                const hideOutliers = !balanceTrendChart.options.scales.y.max;

                if (hideOutliers) {
                    // 计算一个合理的最大值 (去除异常值)
                    const data = balanceTrendChart.data.datasets[0].data;
                    const sortedData = [...data].sort((a, b) => a - b);
                    const q3Index = Math.floor(sortedData.length * 0.75);
                    const q3 = sortedData[q3Index];
                    const maxNormal = q3 * 2; // 一个简单的启发式计算正常范围的最大值

                    balanceTrendChart.options.scales.y.max = maxNormal;
                    trendViewToggle.textContent = translations.admin_js_button_show_outliers || "Show Outliers";
                } else {
                    // 恢复自动缩放
                    balanceTrendChart.options.scales.y.max = undefined;
                    trendViewToggle.textContent = translations.admin_js_button_hide_outliers || "Hide Outliers";
                }

                balanceTrendChart.update();
            }
        });
    }

    // 全局多选控件
    document.getElementById("select-all-keys").addEventListener("change", function () {
        const tableCheckbox = document.getElementById("select-all-table");
        if (tableCheckbox) {
            tableCheckbox.checked = this.checked;

            // 触发表格全选按钮的change事件
            const event = new Event("change");
            tableCheckbox.dispatchEvent(event);
        }
    });

    // 显示/隐藏批量配置面板
    document.getElementById("toggle-batch-config").addEventListener("click", function () {
        const configPanel = document.getElementById("batch-config-panel");
        configPanel.classList.toggle("show");
        this.classList.toggle("active");

        // 使用平滑动画效果更新按钮文本
        const btnText = this.querySelector("span");
        const btnIcon = this.querySelector("svg");

        if (configPanel.classList.contains("show")) {
            // 配置面板显示状态
            btnIcon.style.transform = "rotate(180deg)";
            btnText.textContent = translations.admin_js_button_click_to_collapse || "Click to Collapse";

            // 平滑滚动到配置面板
            setTimeout(() => {
                configPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }, 100);
        } else {
            // 配置面板隐藏状态
            btnIcon.style.transform = "rotate(0)";
            btnText.textContent = translations.admin_js_button_advanced_settings || "Advanced Settings";
        }
    });

    // 批量检测按钮
    document.getElementById("check-selected-keys").addEventListener("click", async () => {
        try {
            await batchCheckSelectedKeys();
        } catch (error) {
            console.error("批量检测出错:", error);
        }
    });
    // 批量删除按钮
    document
        .getElementById("delete-selected-keys")
        .addEventListener("click", batchDeleteSelectedKeys);

    // 回车按钮检测
    const modalInput = document.getElementById("modal-input");
    modalInput.addEventListener("keypress", e => {
        if (e.key === "Enter") {
            handleModalConfirm();
        }
    });

    // 仪表盘
    document.getElementById("refresh-stats-btn").addEventListener("click", loadDashboard);
    document.getElementById("update-balances-btn").addEventListener("click", updateAllBalances);

    // 密钥
    document.getElementById("add-key-btn").addEventListener("click", addKey);
    document.getElementById("add-bulk-keys-btn").addEventListener("click", addBulkKeys);

    // 按Enter键添加单个密钥
    document.getElementById("add-key-input").addEventListener("keypress", event => {
        if (event.key === "Enter") {
            addKey();
        }
    });

    // 添加间隔类型切换逻辑
    const intervalTypeSelect = document.getElementById("interval-type");

    // 初始化输入框状态
    updateIntervalFields();

    // 监听间隔类型变化
    intervalTypeSelect.addEventListener("change", updateIntervalFields);

    function updateIntervalFields() {
        const intervalType = intervalTypeSelect.value;
        const minIntervalInput = document.getElementById("min-interval");
        const maxIntervalInput = document.getElementById("max-interval");
        const fixedIntervalInput = document.getElementById("concurrency");

        if (intervalType === "fixed") {
            // 启用固定间隔，禁用随机间隔
            fixedIntervalInput.disabled = false;
            minIntervalInput.disabled = true;
            maxIntervalInput.disabled = true;

            // 视觉反馈
            fixedIntervalInput.style.opacity = "1";
            minIntervalInput.style.opacity = "0.5";
            maxIntervalInput.style.opacity = "0.5";
        } else {
            // 启用随机间隔，禁用固定间隔
            fixedIntervalInput.disabled = true;
            minIntervalInput.disabled = false;
            maxIntervalInput.disabled = false;

            // 视觉反馈
            fixedIntervalInput.style.opacity = "0.5";
            minIntervalInput.style.opacity = "1";
            maxIntervalInput.style.opacity = "1";
        }
    }

    // 增强批量配置面板可见性
    enhanceBatchConfigPanelVisibility();

    // 下拉菜单控制
    const moreActionsBtn = document.getElementById("more-actions");
    const dropdownContent = document.querySelector(".dropdown-content");

    moreActionsBtn.addEventListener("click", e => {
        e.stopPropagation();
        dropdownContent.classList.toggle("show");

        // 添加或移除活跃状态样式
        moreActionsBtn.classList.toggle("active", dropdownContent.classList.contains("show"));
    });

    // 点击其他地方关闭下拉菜单
    document.addEventListener("click", e => {
        if (!moreActionsBtn.contains(e.target)) {
            dropdownContent.classList.remove("show");
            moreActionsBtn.classList.remove("active");
        }
    });

    // 导出选中密钥
    document.getElementById("export-selected-keys").addEventListener("click", exportSelectedKeys);

    // 清除无效密钥
    document.getElementById("clear-invalid-keys").addEventListener("click", clearInvalidKeys);

    // 导出有效密钥
    document.getElementById("export-valid-keys").addEventListener("click", exportValidKeys);

    // 导出高余额密钥
    document
        .getElementById("export-balance-keys")
        .addEventListener("click", showBalanceFilterModal);

    // 复制所有密钥
    document.getElementById("copy-all-keys").addEventListener("click", copyAllKeys);

    // 复制所选密钥
    document.getElementById("copy-selected-keys").addEventListener("click", copySelectedKeys);

    // 导出过滤后的密钥按钮
    document.getElementById("export-filtered-keys").addEventListener("click", exportFilteredKeys);

    // 停止批量处理按钮点击事件
    document.getElementById("stop-batch-process").addEventListener("click", stopBatchProcessing);

    // 更新分隔符文本显示
    document.getElementById("delimiter-select").addEventListener("change", updateDelimiterDisplay);

    // 更新导出按钮状态
    function updateExportButtonState() {
        document.getElementById("export-selected-keys").disabled = selectedKeys.size === 0;
    }

    // 初始化分隔符显示
    updateDelimiterDisplay();

    // 添加事件监听器
    document.getElementById("delimiter-select").addEventListener("change", updateDelimiterDisplay);
    document.getElementById("custom-delimiter").addEventListener("input", updateDelimiterDisplay);

    // 扩展更新选择状态函数
    const originalUpdateSelectionStatus = updateSelectionStatus;
    window.updateSelectionStatus = function () {
        originalUpdateSelectionStatus();
        updateExportButtonState();
    };

    // 访问控制选择变化时
    const accessControlSelect = document.getElementById("access-control-select");
    if (accessControlSelect) {
        accessControlSelect.addEventListener("change", function () {
            toggleGuestPasswordField(this.value);
        });
    }

    // 设置表单提交事件
    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
        settingsForm.addEventListener("submit", function (event) {
            event.preventDefault();
            saveSettings(event);
        });
    }

            // 全选/取消全选表格中的所有密钥
    const selectAllTableCheckbox = document.getElementById("select-all-table");
    if (selectAllTableCheckbox) {
        selectAllTableCheckbox.addEventListener("change", function () {
            const checkboxes = document.querySelectorAll(".key-checkbox");
            if (checkboxes.length === 0) {
                return; // 如果没有复选框则不操作
            }

            checkboxes.forEach(checkbox => {
                // 只有当状态不一致时才更新，避免不必要的事件触发
                if (checkbox.checked !== this.checked) {
                    checkbox.checked = this.checked;

                    // 调用toggleKeySelection函数更新数据
                    const keyValue = checkbox.closest("tr").getAttribute("data-key");
                    toggleKeySelection(keyValue, this.checked);
                }
            });

            // 显示通知
            if (this.checked) {
                showToast((translations.admin_js_toast_all_keys_selected || "Selected all {{count}} keys.").replace("{{count}}", checkboxes.length));
            } else {
                showToast(translations.admin_js_toast_all_selection_cancelled || "Cancelled all selections.");
            }
        });
    }

    // 初始加载
    loadDashboard();

    // 如果在设置标签页，也加载设置
    const settingsTab = document.querySelector(".tab[data-tab='settings']");
    if (settingsTab && settingsTab.classList.contains("active")) {
        loadSettings();
    }

    // 监听每页显示数量变更
    const keysPerPageSelect = document.getElementById("keys-per-page");
    if (keysPerPageSelect) {
        keysPerPageSelect.addEventListener("change", function () {
            loadAllKeys(1); // 切换每页显示数量时，重置到第一页
        });
    }

    // 监听搜索输入框
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                loadAllKeys(1); // 搜索时重置到第一页
            }
        });
    }

    // 隐藏分页控件区域
    const paginationContainer = document.getElementById("pagination-container");
    if (paginationContainer) {
        paginationContainer.style.display = "none";
    }
    
    // 隐藏每页显示选项
    const pageSizeControl = document.querySelector(".page-size-control");
    if (pageSizeControl) {
        pageSizeControl.style.display = "none";
    }
});

// 设置功能
async function loadSettings(attempts = 3) {
    try {
        // 添加一个随机参数防止缓存
        const timestamp = new Date().getTime();
        const response = await fetch(`/admin/api/config?_=${timestamp}`, {
            // 添加超时处理
            signal: AbortSignal.timeout(10000), // 10秒超时
        });

        if (!response.ok) {
            throw new Error((translations.admin_js_load_config_fail_status || "Failed to load config: Status {{statusCode}}").replace("{{statusCode}}", response.status));
        }

        const result = await response.json();

        if (result.success) {
            const config = result.data;

            // 设置各个字段的值，增加错误处理
            const apiKeyInput = document.getElementById("api-key-input");
            const adminUsernameInput = document.getElementById("admin-username-input");
            const adminPasswordInput = document.getElementById("admin-password-input");
            const pageSizeInput = document.getElementById("page-size-input");
            const httpProxyInput = document.getElementById("http-proxy-input");
            const accessControlSelect = document.getElementById("access-control-select");
            const guestPasswordInput = document.getElementById("guest-password-input");

            if (apiKeyInput) apiKeyInput.value = config.apiKey || "";
            if (adminUsernameInput) adminUsernameInput.value = config.adminUsername || "";
            if (adminPasswordInput) adminPasswordInput.value = ""; // 不预填密码
            if (pageSizeInput) pageSizeInput.value = config.pageSize || 10;
            if (httpProxyInput) httpProxyInput.value = config.httpProxy || "";

            // 设置访问控制选项
            if (accessControlSelect) {
                accessControlSelect.value = config.accessControl || "open";
                // 确保触发change事件
                const event = new Event("change");
                accessControlSelect.dispatchEvent(event);
            }

            // 显示/隐藏访客密码输入框
            toggleGuestPasswordField(config.accessControl || "open");

            // 预填访客密码（如果存在）
            if (guestPasswordInput) {
                guestPasswordInput.value = ""; // 出于安全考虑，不预填真实密码
                guestPasswordInput.placeholder = config.guestPassword
                    ? (translations.admin_js_guest_password_set_placeholder || "Guest password is set (not displayed)")
                    : (translations.admin_js_set_guest_password_placeholder || "Set guest password");
            }

            showToast(translations.admin_js_toast_settings_load_success || "Settings loaded successfully.");
        } else {
            throw new Error(result.message || (translations.admin_js_unknown_error || "Unknown error"));
        }
    } catch (error) {
        console.error("Error loading settings:", error); // Non-user facing

        // 如果还有重试次数，尝试重试
        if (attempts > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒再重试
            return loadSettings(attempts - 1);
        }

        // 显示错误提示
        showToast((translations.admin_js_toast_load_settings_fail_error || "Failed to load settings: {{error}}").replace("{{error}}", error.message), true);
    }
}

// 保存设置功能
async function saveSettings(event) {
    if (event) event.preventDefault();

    try {
        // 获取所有输入值
        const apiKey = document.getElementById("api-key-input").value.trim();
        const adminUsername = document.getElementById("admin-username-input").value.trim();
        const adminPassword = document.getElementById("admin-password-input").value.trim();
        const pageSize = document.getElementById("page-size-input").value.trim();
        const httpProxy = document.getElementById("http-proxy-input").value.trim();
        const accessControl = document.getElementById("access-control-select").value;
        const guestPassword = document.getElementById("guest-password-input").value.trim();

        // 验证表单
        if (
            accessControl === "partial" &&
            !guestPassword &&
            !document.getElementById("guest-password-input").placeholder.includes(translations.admin_js_guest_password_set_placeholder || "Guest password is set (not displayed)")
        ) {
            showToast(translations.admin_js_toast_set_guest_password || "Please set a guest password.", true);
            return;
        }

        // 准备数据
        const data = {
            apiKey,
            adminUsername,
            pageSize: parseInt(pageSize) || 10,
            httpProxy,
            accessControl,
        };

        // 仅当有输入密码时才更新密码
        if (adminPassword) {
            data.adminPassword = adminPassword;
        }

        // 仅当访问控制为部分开放并且输入了密码时更新访客密码
        if (accessControl === "restricted" && guestPassword) {
            data.guestPassword = guestPassword;
        }


        // 发送请求
        const response = await fetch("/admin/api/update-config", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error((translations.admin_js_save_settings_fail_status || "Failed to save settings: Status {{statusCode}}").replace("{{statusCode}}", response.status));
        }

        const result = await response.json();
        if (result.success) {
            showToast(translations.admin_js_toast_settings_save_success || "Settings saved successfully.");

            // 清空密码字段
            document.getElementById("admin-password-input").value = "";
            document.getElementById("guest-password-input").value = "";

            // 更新访客密码提示
            if (accessControl === "restricted" && guestPassword) { // "partial" was a typo, should be "restricted"
                document.getElementById("guest-password-input").placeholder =
                    (translations.admin_js_guest_password_set_placeholder || "Guest password is set (not displayed)");
            }
        } else {
            throw new Error(result.message || (translations.admin_js_toast_save_settings_fail_error ? translations.admin_js_toast_save_settings_fail_error.replace("{{error}}", "") : "Failed to save settings"));
        }
    } catch (error) {
        console.error("Error saving settings:", error); // Non-user facing
        showToast(error.message, true); // error.message should be translated
    }
}

// 切换访客密码输入框显示/隐藏
function toggleGuestPasswordField(accessControlValue) {
    const guestPasswordGroup = document.getElementById("guest-password-group");
    if (accessControlValue === "restricted") {
        guestPasswordGroup.style.display = "block";
    } else {
        guestPasswordGroup.style.display = "none";
    }
}

// 更新分隔符显示
function updateDelimiterDisplay() {
    const delimiterSelect = document.getElementById("delimiter-select");
    const customDelimiterInput = document.getElementById("custom-delimiter");
    const delimiterDisplay = document.getElementById("delimiter-display");

    let delimiter = "";
    let delimiterKey = "delimiter_newline"; // Default

    if (delimiterSelect.value === "custom") {
        customDelimiterInput.style.display = "inline-block";
        delimiter = customDelimiterInput.value || "";
        delimiterKey = ""; // Custom doesn't have a direct translation key for the value itself
    } else {
        customDelimiterInput.style.display = "none";
        switch (delimiterSelect.value) {
            case "newline": delimiterKey = "delimiter_newline"; break;
            case "comma": delimiterKey = "delimiter_comma"; break;
            case "tab": delimiterKey = "delimiter_tab"; break;
            case "space": delimiterKey = "delimiter_space"; break;
            default: delimiterKey = "delimiter_newline";
        }
        delimiter = translations[delimiterKey] || delimiterSelect.value;
    }

    delimiterDisplay.textContent = delimiter ? (translations.admin_js_delimiter_display_format || 'Delimiter: "{{delimiter}}"').replace("{{delimiter}}", delimiter) : (translations.admin_js_delimiter_select_prompt || "Please select a delimiter");
}

// 批量删除选中的密钥
async function batchDeleteSelectedKeys() {
    if (selectedKeys.size === 0) {
        showToast(translations.admin_js_toast_select_keys_to_delete || "Please select keys to delete", true);
        return;
    }

    // 将 Set 转换为数组以防止后续操作中的引用问题
    const keysToDelete = Array.from(selectedKeys);
    
    const message = (translations.admin_js_confirm_delete_selected_keys_message || "Are you sure you want to delete the selected {{count}} keys? This action cannot be undone.").replace("{{count}}", keysToDelete.length);

    confirmDialog(
        message,
        async confirmed => {
            if (!confirmed) {
                console.warn("User cancelled delete operation"); // Non-user facing
                return;
            }

            try {
                // 显示加载中提示
                showToast(translations.admin_js_toast_deleting_keys_wait || "Deleting keys, please wait...");

                const response = await fetch("/admin/api/delete-keys", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ keys: keysToDelete }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Server returned error:", errorText); // Non-user facing
                    throw new Error((translations.admin_js_toast_delete_keys_fail_error || "Failed to delete keys: {{error}}").replace("{{error}}", `${response.status} ${errorText}`));
                }

                const result = await response.json();
                if (result.success) {
                    showToast((translations.admin_js_toast_keys_deleted_success || "Successfully deleted {{count}} keys.").replace("{{count}}", result.deleted));
                    // 清空选中的密钥
                    selectedKeys.clear();
                    // 重新加载密钥列表
                    loadAllKeys();
                    // 更新仪表盘
                    loadDashboard();
                } else {
                    throw new Error(result.message || (translations.admin_js_toast_delete_keys_fail_error ? translations.admin_js_toast_delete_keys_fail_error.replace("{{error}}", "") : "Failed to delete keys"));
                }
            } catch (error) {
                console.error("Error deleting keys:", error); // Non-user facing
                showToast(error.message, true); // error.message should already be translated if it came from the above throw
            }
        },
        {
            confirmText: translations.admin_js_confirm_delete_button || "Confirm Delete",
            cancelText: translations.admin_js_modal_default_cancel || "Cancel", // Using existing general cancel
            title: translations.delete_button || "Delete" // Using existing general delete as title
        }
    );
}

// 加载所有密钥到密钥管理页面
async function loadAllKeys(page = 1) {
    try {
        const searchInputElement = document.getElementById("search-input");
        const searchQuery = searchInputElement ? searchInputElement.value.trim() : "";

        // 构建查询参数 - 设置很大的limit值以获取所有密钥
        const params = new URLSearchParams({
            sort: currentSortField,
            order: currentSortOrder,
            limit: 10000 // 设置一个很大的值来获取所有密钥
        });

        // 如果有搜索查询，添加到参数中
        if (searchQuery) {
            params.append("search", searchQuery);
        }

        const response = await fetch(`/admin/api/keys?${params.toString()}`);

        if (!response.ok) {
            throw new Error("加载密钥失败");
        }

        const result = await response.json();

        if (result.success) {
            renderKeysTable(result.data, result.total);
            updateSelectionStatus();
        } else {
            throw new Error(result.message || "加载密钥失败");
        }
    } catch (error) {
        console.error("加载密钥时出错:", error);
        showToast(`加载密钥失败: ${error.message}`, true);
    }
}

// 渲染密钥表格
function renderKeysTable(keys, totalKeys) {
    const tableBody = document.getElementById("keys-table-body");
    const paginationContainer = document.getElementById("pagination-container");

    // 清空表格
    tableBody.innerHTML = "";

    if (keys.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center">${translations.admin_js_no_keys_found_table || "No keys found"}</td></tr>`;
        paginationContainer.innerHTML = "";
        return;
    }

    // 隐藏分页容器
    if (paginationContainer) {
        paginationContainer.style.display = "none";
    }

    // 隐藏每页显示选项
    const pageSizeControl = document.querySelector(".page-size-control");
    if (pageSizeControl) {
        pageSizeControl.style.display = "none";
    }

    // 填充表格数据
    keys.forEach((key, index) => {
        const row = document.createElement("tr");
        row.setAttribute("data-key", key.key);

        // 确定行的状态类
        let rowClass = "";
        if (key.lastError) {
            rowClass = "error";
        } else if (parseFloat(key.balance) <= 0) {
            rowClass = "warning";
        }

        if (rowClass) {
            row.classList.add(rowClass);
        }

        // 如果密钥在选中集合中，设置选中状态
        const isSelected = selectedKeys.has(key.key);
        if (isSelected) {
            row.classList.add("selected");
        }

        // 序号直接使用索引加1
        const itemNumber = index + 1;

        row.innerHTML = `
            <td>${itemNumber}</td>
            <td>
                <input type="checkbox" class="key-checkbox" ${isSelected ? "checked" : ""}>
            </td>
            <td class="key-cell">${key.key}</td>
            <td>${key.balance || "0.00"}</td>
            <td>${key.lastUpdated ? new Date(key.lastUpdated).toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US') : (translations.admin_js_last_updated_never || "Never")}</td>
            <td>${new Date(key.added).toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US')}</td>
            <td>${
                key.lastError
                    ? (translations.admin_js_status_html_failed || '<span class="error-text">Failed</span>')
                    : parseFloat(key.balance) <= 0
                    ? (translations.admin_js_status_html_insufficient_balance || '<span class="warning-text">Insufficient Balance</span>')
                    : (translations.admin_js_status_html_normal || '<span class="success-text">Normal</span>')
            }</td>
            <td>
                <div class="actions">
                    <button class="btn btn-sm btn-outline check-key-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </button>
                    <button class="btn btn-sm btn-outline copy-key-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    <button class="btn btn-sm btn-outline danger delete-key-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </td>
        `;

        // 添加事件监听器
        // 1. 复选框事件
        const checkbox = row.querySelector(".key-checkbox");
        if (checkbox) {
            checkbox.addEventListener("change", function () {
                toggleKeySelection(key.key, this.checked);
            });
        }

        // 2. 检测按钮事件
        const checkBtn = row.querySelector(".check-key-btn");
        if (checkBtn) {
            checkBtn.addEventListener("click", function () {
                checkKey(key.key);
            });
        }

        // 3. 复制按钮事件
        const copyBtn = row.querySelector(".copy-key-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", function () {
                copyKey(key.key);
            });
        }

        // 4. 删除按钮事件
        const deleteBtn = row.querySelector(".delete-key-btn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", function () {
                deleteKey(key.key);
            });
        }

        tableBody.appendChild(row);
    });

    // 更新选择状态显示
    updateSelectionStatus();

    // 检查并同步全选框状态
    check_all_selected();
}

// 加载最近添加的密钥到仪表盘
async function loadRecentKeys() {
    try {
        // 检查表格主体元素是否存在
        if (!document.getElementById("recent-keys-table-body")) {
            console.warn("未找到最近密钥表格元素，可能不在仪表盘页面");
            return;
        }

        const response = await fetch("/admin/api/keys?limit=5&sort=added&order=desc");

        if (!response.ok) {
            throw new Error("加载最近密钥失败");
        }

        const result = await response.json();

        if (result.success) {
            renderRecentKeysTable(result.data);
        } else {
            throw new Error(result.message || "加载最近密钥失败");
        }
    } catch (error) {
        console.error("加载最近密钥时出错:", error);
        showToast(`加载最近密钥失败: ${error.message}`, true);
    }
}

// 渲染最近添加的密钥表格
function renderRecentKeysTable(keys) {
    const tableBody = document.getElementById("recent-keys-table-body");

    // 检查表格主体元素是否存在
    if (!tableBody) {
        console.warn("Recent keys table body not found"); // Non-user facing
        return;
    }

    // 清空表格
    tableBody.innerHTML = "";

    if (keys.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center">${translations.admin_js_no_keys_found_table || "No keys found"}</td></tr>`;
        return;
    }

    // 填充表格数据
    keys.forEach(key => {
        const row = document.createElement("tr");

        // 确定行的状态类
        let rowClass = "";
        if (key.lastError) {
            rowClass = "error";
        } else if (parseFloat(key.balance) <= 0) {
            rowClass = "warning";
        }

        if (rowClass) {
            row.classList.add(rowClass);
        }

        row.innerHTML = `
            <td class="key-cell">${key.key}</td>
            <td>${key.balance || "0.00"}</td>
            <td>${new Date(key.added).toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US')}</td>
            <td>${
                key.lastError
                    ? (translations.admin_js_status_html_failed || '<span class="error-text">Failed</span>')
                    : parseFloat(key.balance) <= 0
                    ? (translations.admin_js_status_html_insufficient_balance || '<span class="warning-text">Insufficient Balance</span>')
                    : (translations.admin_js_status_html_normal || '<span class="success-text">Normal</span>')
            }</td>
        `;

        tableBody.appendChild(row);
    });
}

// 更新选择状态显示
function updateSelectionStatus() {
    const selectedCount = document.getElementById("selection-count");
    if (selectedCount) {
        selectedCount.textContent = (translations.admin_js_selected_keys_count_text_dynamic || "Selected {{count}} Keys").replace("{{count}}", selectedKeys.size);
    }

    // 显示/隐藏批量操作工具栏
    const batchTools = document.getElementById("batch-tools");
    if (batchTools) {
        if (selectedKeys.size > 0) {
            batchTools.classList.add("show");
        } else {
            batchTools.classList.remove("show");
        }
    }

    // 更新导出按钮状态
    const exportSelectedBtn = document.getElementById("export-selected-keys");
    if (exportSelectedBtn) {
        exportSelectedBtn.disabled = selectedKeys.size === 0;
    }

    // 更新检测和删除按钮状态
    const checkSelectedBtn = document.getElementById("check-selected-keys");
    const deleteSelectedBtn = document.getElementById("delete-selected-keys");

    if (checkSelectedBtn) {
        checkSelectedBtn.disabled = selectedKeys.size === 0;
    }

    if (deleteSelectedBtn) {
        deleteSelectedBtn.disabled = selectedKeys.size === 0;
    }

    // 确保表头全选框状态与实际选择状态一致
    check_all_selected();
}

// 检查是否所有行都被选中，并更新表头全选框状态
function check_all_selected() {
    const selectAllTableCheckbox = document.getElementById("select-all-table");
    if (selectAllTableCheckbox) {
        const checkboxes = document.querySelectorAll(".key-checkbox");

        // 如果没有复选框或表格为空，则取消选中表头复选框
        if (checkboxes.length === 0) {
            selectAllTableCheckbox.checked = false;
            return;
        }

        const allChecked = Array.from(checkboxes).every(cb => cb.checked);

        // 避免不必要的状态变更，仅当状态不一致时才更新
        if (selectAllTableCheckbox.checked !== allChecked) {
            selectAllTableCheckbox.checked = allChecked;
        }
    }
}

// 切换单个密钥选择状态
function toggleKeySelection(key, isSelected) {
    if (isSelected) {
        selectedKeys.add(key);
    } else {
        selectedKeys.delete(key);
    }

    // 更新表格行的选中状态
    const row = document.querySelector(`tr[data-key="${key}"]`);
    if (row) {
        if (isSelected) {
            row.classList.add("selected");
        } else {
            row.classList.remove("selected");
        }
    }

    // 更新显示
    updateSelectionStatus();

    // 检查是否所有行都被选中，并更新表头全选框状态
    check_all_selected();
}

// 批量检测选中的密钥
async function batchCheckSelectedKeys() {
    if (selectedKeys.size === 0) {
        showToast(translations.admin_js_select_keys_to_check || "Please select keys to check", true);
        return;
    }

    // 重置停止标志
    isBatchProcessingStopped = false;

    // 显示进度条
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");
    const progressTitle = document.querySelector(".progress-title");
    const progressSuccessRate = document.getElementById("progress-success-rate");
    const progressSpeed = document.getElementById("progress-speed");
    const progressEta = document.getElementById("progress-eta");
    const progressElapsed = document.getElementById("progress-elapsed");
    const cancelButton = document.getElementById("stop-batch-process");

    if (progressContainer) {
        progressContainer.style.display = "block";
        // 添加active类以显示进度容器
        setTimeout(() => {
            progressContainer.classList.add("active");
        }, 10);
    }
    if (progressBar) progressBar.style.width = "0%";
    if (progressText) progressText.textContent = "0/" + selectedKeys.size;
    if (progressTitle) progressTitle.textContent = translations.admin_js_progress_checking_balances || "Checking Key Balances";
    if (progressSuccessRate) progressSuccessRate.textContent = (translations.admin_js_progress_success_rate_format || "Success: {{count}} ({{rate}}%)").replace("{{count}}", "0").replace("{{rate}}", "0.0");
    if (cancelButton) cancelButton.style.display = "inline-block";

    // 初始化进度统计变量
    const startTime = Date.now();
    let successCount = 0;
    let lastUpdateTime = startTime;
    let lastCompletedCount = 0;

    // 更新进度详情的函数
    const updateProgressDetails = (completed) => {
        // 计算已用时间
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const remainingSecondsInMin = elapsedSeconds % 60;
        
        let elapsedText;
        if (elapsedMinutes > 0) {
            elapsedText = (translations.admin_js_progress_time_format_minutes_seconds || "{{minutes}}m {{seconds}}s")
                .replace("{{minutes}}", elapsedMinutes)
                .replace("{{seconds}}", remainingSecondsInMin);
        } else {
            elapsedText = (translations.admin_js_progress_time_format_seconds || "{{seconds}}s")
                .replace("{{seconds}}", elapsedSeconds);
        }
        if (progressElapsed) progressElapsed.textContent = elapsedText;
        
        // 计算成功率
        if (progressSuccessRate && completed > 0) {
            const successRate = ((successCount / completed) * 100).toFixed(1);
            progressSuccessRate.textContent = (translations.admin_js_progress_success_rate_format || "Success: {{count}} ({{rate}}%)")
                .replace("{{count}}", successCount)
                .replace("{{rate}}", successRate);
        }

        // 计算处理速度
        if (progressSpeed && completed > 0) {
            const timeDiff = Date.now() - lastUpdateTime;
            if (timeDiff > 0 && completed > lastCompletedCount) {
                const countDiff = completed - lastCompletedCount;
                const speed = (countDiff / timeDiff) * 1000; // 每秒处理数量
                progressSpeed.textContent = (translations.admin_js_progress_speed_format || "{{speed}} keys/s").replace("{{speed}}", speed.toFixed(2));
                
                // 更新预计剩余时间
                if (progressEta) {
                    const remaining = selectedKeys.size - completed;
                    if (speed > 0) {
                        const etaSeconds = Math.ceil(remaining / speed);
                        if (etaSeconds < 60) {
                            progressEta.textContent = (translations.admin_js_progress_eta_seconds_format || "Approx. {{seconds}}s").replace("{{seconds}}", etaSeconds);
                        } else {
                            const etaMinutes = Math.floor(etaSeconds / 60);
                            const remainingSecsEta = etaSeconds % 60;
                            progressEta.textContent = (translations.admin_js_progress_eta_minutes_seconds_format || "Approx. {{minutes}}m {{seconds}}s")
                                .replace("{{minutes}}", etaMinutes)
                                .replace("{{seconds}}", remainingSecsEta);
                        }
                    } else {
                        progressEta.textContent = translations.progress_calculating || "Calculating...";
                    }
                }
                
                // 更新最后记录的时间和完成数
                lastUpdateTime = Date.now();
                lastCompletedCount = completed;
            }
        }
    };

    // 获取并验证间隔设置
    const intervalType = document.getElementById("interval-type").value;
    let delay = 0;

    try {
        // 根据间隔类型设置延迟
        if (intervalType === "fixed") {
            // 固定间隔
            const concurrency = parseInt(document.getElementById("concurrency").value) || 1;
            if (concurrency < 1) throw new Error(translations.admin_js_error_concurrency_must_be_positive || "Concurrency must be greater than 0");

            // 使用并发处理
            const keysArray = Array.from(selectedKeys);
            const results = [];
            let completed = 0;

            // 分批处理
            for (let i = 0; i < keysArray.length; i += concurrency) {
                if (isBatchProcessingStopped) {
                    showToast(translations.admin_js_toast_batch_check_stopped || "Batch check stopped.");
                    break;
                }

                const batch = keysArray.slice(i, i + concurrency);
                const batchPromises = batch.map(key => checkKeyWithRetry(key));
                const batchResults = await Promise.allSettled(batchPromises);

                // 更新成功计数
                successCount += batchResults.filter(r => r.status === "fulfilled").length;
                
                results.push(...batchResults);
                completed += batch.length;

                // 更新进度
                if (progressBar)
                    progressBar.style.width = (completed / selectedKeys.size) * 100 + "%";
                if (progressText) 
                    progressText.textContent = `${completed}/${selectedKeys.size} (${Math.round(completed / selectedKeys.size * 100)}%)`;
                
                // 更新详细进度信息
                updateProgressDetails(completed);
            }

            // 处理结果
            handleBatchResults(results);
        } else {
            // 随机间隔
            const minInterval = parseInt(document.getElementById("min-interval").value) || 1000;
            const maxInterval = parseInt(document.getElementById("max-interval").value) || 3000;

            if (minInterval < 0) throw new Error(translations.admin_js_error_min_interval_non_negative || "Minimum interval cannot be less than 0");
            if (maxInterval < minInterval) throw new Error(translations.admin_js_error_max_interval_greater_than_min || "Maximum interval cannot be less than minimum interval");

            // 依次处理每个密钥
            const keysArray = Array.from(selectedKeys);
            const results = [];

            for (let i = 0; i < keysArray.length; i++) {
                if (isBatchProcessingStopped) {
                    showToast(translations.admin_js_toast_batch_check_stopped || "Batch check stopped.");
                    break;
                }

                const key = keysArray[i];
                // 随机延迟
                if (i > 0) {
                    const randomDelay =
                        Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
                    await new Promise(resolve => setTimeout(resolve, randomDelay));
                }

                try {
                    const result = await checkKeyWithRetry(key);
                    results.push({ status: "fulfilled", value: result });
                    successCount++;
                } catch (error) {
                    results.push({ status: "rejected", reason: error });
                }

                // 更新进度
                const completed = i + 1;
                if (progressBar)
                    progressBar.style.width = (completed / selectedKeys.size) * 100 + "%";
                if (progressText) 
                    progressText.textContent = `${completed}/${selectedKeys.size} (${Math.round(completed / selectedKeys.size * 100)}%)`;
                
                // 更新详细进度信息
                updateProgressDetails(completed);
            }

            // 处理结果
            handleBatchResults(results);
        }
    } catch (error) {
        showToast(error.message, true);
    } finally {
        // 隐藏进度条
        if (progressContainer) {
            progressContainer.classList.remove("active");
            // 等待动画完成后隐藏
            setTimeout(() => {
                progressContainer.style.display = "none";
            }, 400); // 与CSS中的过渡时间保持一致
        }
        if (cancelButton) cancelButton.style.display = "none";
    }
}

// 处理批量检测结果
function handleBatchResults(results) {
    const successful = results.filter(r => r.status === "fulfilled").length;
    const failed = results.length - successful;

    showToast((translations.admin_js_toast_batch_check_complete || "Batch check complete. Success: {{successful}}, Failed: {{failed}}.")
        .replace("{{successful}}", successful)
        .replace("{{failed}}", failed));

    // 重新加载数据
    loadAllKeys();
}

// 带有重试的密钥检测
async function checkKeyWithRetry(key, maxRetries = 2) {
    let retries = 0;

    while (retries <= maxRetries) {
        try {
            return await checkKey(key);
        } catch (error) {
            retries++;
            if (retries > maxRetries) throw error;
            // 等待一段时间再重试
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// 检测单个密钥
async function checkKey(key) {
    try {
        const response = await fetch("/admin/api/update-key-balance", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ key }),
        });

        if (!response.ok) {
            throw new Error(translations.admin_js_check_key_fail || "Failed to check key");
        }

        const result = await response.json();

        if (result.success) {
            const row = document.querySelector(`tr[data-key="${key}"]`);

            if (row) {
                // 更新表格行
                const balanceCell = row.querySelector("td:nth-child(4)");
                const statusCell = row.querySelector("td:nth-child(7)");
                const lastUpdatedCell = row.querySelector("td:nth-child(5)");

                if (balanceCell) balanceCell.textContent = result.balance || "0.00";

                if (statusCell) {
                    if (result.error) {
                        statusCell.innerHTML = translations.admin_js_status_html_failed || '<span class="error-text">Failed</span>';
                        row.className = "error";
                    } else if (parseFloat(result.balance) <= 0) {
                        statusCell.innerHTML = translations.admin_js_status_html_insufficient_balance || '<span class="warning-text">Insufficient Balance</span>';
                        row.className = "warning";
                    }
                     else {
                        statusCell.innerHTML = translations.admin_js_status_html_normal || '<span class="success-text">Normal</span>';
                        row.className = "";
                    }
                }

                if (lastUpdatedCell) lastUpdatedCell.textContent = new Date().toLocaleString(currentLang === 'tr' ? 'tr-TR' : 'en-US');
            }
            const statusText = result.error ? (translations.admin_js_chart_status_error || "Error") : (translations.admin_js_chart_status_valid || "Valid");
            showToast((translations.admin_js_toast_key_check_complete_status || "Key check complete: {{status}}").replace("{{status}}", statusText));
            return result;
        } else {
            throw new Error(result.message || (translations.admin_js_check_key_fail || "Failed to check key"));
        }
    } catch (error) {
        console.error("Error checking key:", error); // Non-user facing
        showToast(error.message, true); // error.message should be translated if it came from above
        throw error;
    }
}

// 停止批量处理
function stopBatchProcessing() {
    isBatchProcessingStopped = true;
    showToast(translations.admin_js_toast_stopping_batch_process || "Stopping batch process...");
}

// 隐藏进度容器
function hideProgress() {
    const progressContainer = document.getElementById("progress-container");
    if (progressContainer) {
        progressContainer.classList.remove("active");
        // 等待动画完成后隐藏
        setTimeout(() => {
            progressContainer.style.display = "none";
        }, 400); // 与CSS中的过渡时间保持一致
    }
}

// 更新所有密钥余额
async function updateAllBalances() {
    try {
        const response = await fetch("/admin/api/update-keys-balance", {
            method: "POST",
        });

        if (!response.ok) {
            throw new Error(translations.admin_js_toast_update_balances_fail_error ? translations.admin_js_toast_update_balances_fail_error.replace("{{error}}", "") : "Failed to update balances");
        }

        const result = await response.json();

        if (result.success) {
            showToast(translations.admin_js_toast_update_all_balances_started || "Background update of all key balances has started. Please refresh the page later to see the results.");
        } else {
            throw new Error(result.message || (translations.admin_js_toast_update_balances_fail_error ? translations.admin_js_toast_update_balances_fail_error.replace("{{error}}", "") : "Failed to update balances"));
        }
    } catch (error) {
        console.error("Error updating balances:", error); // Non-user facing
        showToast(error.message, true); // error.message should be translated
    }
}

// 添加单个密钥
async function addKey() {
    const input = document.getElementById("add-key-input");
    const key = input.value.trim();

    if (!key) {
        showToast(translations.admin_js_toast_enter_key || "Please enter a key", true);
        return;
    }

    try {
        const response = await fetch("/admin/api/add-key", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ key }),
        });

        const keyAddFailError = translations.admin_js_toast_load_keys_fail_error ? translations.admin_js_toast_load_keys_fail_error.replace("{{error}}", "add") : "Failed to add key"; // Re-using load keys fail for generic add fail

        if (!response.ok) {
            throw new Error(keyAddFailError);
        }

        const result = await response.json();

        if (result.success) {
            showToast(translations.admin_js_toast_key_add_success || "Key added successfully");
            input.value = ""; // 清空输入框

            // 刷新数据
            loadAllKeys();
            loadDashboard();
        } else {
            throw new Error(result.message || keyAddFailError);
        }
    } catch (error) {
        console.error("Error adding key:", error); // Non-user facing
        showToast(error.message, true); // error.message should be translated
    }
}

// 批量添加密钥
async function addBulkKeys() {
    const textarea = document.getElementById("bulk-keys-input");
    const text = textarea.value.trim();

    if (!text) {
        showToast(translations.admin_js_toast_enter_key || "Please enter a key", true); // Re-use single key message
        return;
    }

    // 分割文本
    const keys = text
        .split(/[\n,;\s]+/) // 支持多种分隔符：换行、逗号、分号、空格
        .map(key => key.trim())
        .filter(key => key); // 过滤空值

    if (keys.length === 0) {
        showToast(translations.admin_js_no_valid_keys_found_bulk || "No valid keys found for bulk add", true);
        return;
    }
    const bulkAddFailError = translations.admin_js_toast_load_keys_fail_error ? translations.admin_js_toast_load_keys_fail_error.replace("{{error}}", "bulk add") : "Failed to bulk add keys";

    try {
        const response = await fetch("/admin/api/add-keys-bulk", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ keys }),
        });

        if (!response.ok) {
            throw new Error(bulkAddFailError);
        }

        const result = await response.json();

        if (result.success) {
            showToast((translations.admin_js_toast_bulk_add_success || "Successfully added {{count}} keys, {{existingCount}} already existed.")
                .replace("{{count}}", result.count)
                .replace("{{existingCount}}", result.addedKeys) // Assuming 'addedKeys' means existing ones, might need clarification on API response
            );
            textarea.value = ""; // 清空输入框

            // 关闭批量添加模态框
            const modal = document.getElementById("bulk-add-modal");
            if (modal) modal.classList.remove("show");
            
            // 刷新数据
            await loadAllKeys();
            loadDashboard();
            
            // 自动选中新添加的密钥
            if (result.keyList && result.keyList.length > 0) {
                // 清除之前的选择
                selectedKeys.clear();
                
                // 将新添加的密钥添加到选中集合
                result.keyList.forEach(key => {
                    selectedKeys.add(key);
                });
                
                // 更新UI中的选中状态
                updateSelectionStatus();
                
                // 更新表格中的复选框
                result.keyList.forEach(key => {
                    const row = document.querySelector(`tr[data-key="${key}"]`);
                    if (row) {
                        const checkbox = row.querySelector(".key-checkbox");
                        if (checkbox) checkbox.checked = true;
                        row.classList.add("selected");
                    }
                });
                
                // 确保检测按钮被启用
                const checkSelectedBtn = document.getElementById("check-selected-keys");
                if (checkSelectedBtn) {
                    checkSelectedBtn.disabled = false;
                }
                
                const deleteSelectedBtn = document.getElementById("delete-selected-keys");
                if (deleteSelectedBtn) {
                    deleteSelectedBtn.disabled = false;
                }
                
                // 直接执行批量检测，无需确认对话框
                batchCheckSelectedKeys();
            }
        } else {
            throw new Error(result.message || bulkAddFailError);
        }
    } catch (error) {
        console.error("Error bulk adding keys:", error); // Non-user facing
        showToast(error.message, true); // error.message should be translated
    }
}

// 删除单个密钥
async function deleteKey(key) {
    confirmDialog(translations.admin_js_confirm_delete_single_key_message || "Are you sure you want to delete this key? This action cannot be undone.", async confirmed => {
        if (!confirmed) return;
        const deleteFailError = translations.admin_js_toast_delete_keys_fail_error ? translations.admin_js_toast_delete_keys_fail_error.replace("{{error}}", "") : "Failed to delete key";
        try {
            const response = await fetch("/admin/api/delete-key", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ key }),
            });

            if (!response.ok) {
                throw new Error(deleteFailError);
            }

            const result = await response.json();

            if (result.success) {
                showToast(translations.admin_js_toast_key_delete_success || "Key deleted successfully");

                // 如果密钥在选中集合中，从中移除
                if (selectedKeys.has(key)) {
                    selectedKeys.delete(key);
                }

                // 刷新数据
                loadAllKeys();
                loadDashboard();
            } else {
                throw new Error(result.message || deleteFailError);
            }
        } catch (error) {
            console.error("Error deleting key:", error); // Non-user facing
            showToast(error.message, true); // error.message should be translated
        }
    });
}

// 复制单个密钥
function copyKey(key) {
    navigator.clipboard
        .writeText(key)
        .then(() => showToast(translations.admin_js_toast_key_copied || "Key copied to clipboard"))
        .catch(() => showToast(translations.admin_js_toast_copy_failed || "Copy failed", true));
}

// 复制所有密钥
async function copyAllKeys() {
    const getKeysFailError = translations.admin_js_get_keys_fail || "Failed to get keys";
    try {
        const response = await fetch("/admin/api/keys?limit=1000"); // Assuming 1000 is enough to get all

        if (!response.ok) {
            throw new Error(getKeysFailError);
        }

        const result = await response.json();

        if (result.success) {
            const keys = result.data.map(k => k.key).join("\n");

            navigator.clipboard
                .writeText(keys)
                .then(() => showToast((translations.admin_js_toast_keys_copied_clipboard || "{{count}} keys copied to clipboard.").replace("{{count}}", result.data.length)))
                .catch(() => showToast(translations.admin_js_toast_copy_failed || "Copy failed", true));
        } else {
            throw new Error(result.message || getKeysFailError);
        }
    } catch (error) {
        console.error("Error copying all keys:", error); // Non-user facing
        showToast(error.message, true); // error.message should be translated
    }
}

// 复制选中的密钥
function copySelectedKeys() {
    if (selectedKeys.size === 0) {
        showToast(translations.copy_selected_keys_action ? (translations.admin_js_toast_select_keys_to_delete || "Please select keys to delete").replace("delete", "copy") : "Please select keys to copy", true); // A bit of a hack, ideally a new key "admin_js_toast_select_keys_to_copy"
        return;
    }

    const keys = Array.from(selectedKeys).join("\n");

    navigator.clipboard
        .writeText(keys)
        .then(() => showToast((translations.admin_js_toast_keys_copied_clipboard || "{{count}} keys copied to clipboard.").replace("{{count}}", selectedKeys.size)))
        .catch(() => showToast(translations.admin_js_toast_copy_failed || "Copy failed", true));
}

// 导出选中的密钥
function exportSelectedKeys() {
    if (selectedKeys.size === 0) {
        showToast(translations.admin_js_select_keys_to_export || "Please select keys to export", true);
        return;
    }

    const keys = Array.from(selectedKeys).join("\n");
    const blob = new Blob([keys], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `selected_keys_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();

    URL.revokeObjectURL(url);
}

// 清除无效密钥
async function clearInvalidKeys() {
    confirmDialog(
        translations.admin_js_confirm_clear_invalid_keys_message || "Are you sure you want to delete all invalid keys (including zero balance and errored keys)? This action cannot be undone.",
        async confirmed => {
            if (!confirmed) return;
            const clearFailError = translations.admin_js_clear_invalid_keys_fail || "Failed to clear invalid keys";
            try {
                const response = await fetch("/admin/api/clear-invalid-keys", {
                    method: "POST",
                });

                if (!response.ok) {
                    throw new Error(clearFailError);
                }

                const result = await response.json();

                if (result.success) {
                    showToast((translations.admin_js_clear_invalid_keys_success_count || "Successfully deleted {{count}} invalid keys.").replace("{{count}}", result.deleted));

                    // 清空选中的密钥
                    selectedKeys.clear();

                    // 刷新数据
                    loadAllKeys();
                    loadDashboard();
                } else {
                    throw new Error(result.message || clearFailError);
                }
            } catch (error) {
                console.error("Error clearing invalid keys:", error); // Non-user facing
                showToast(error.message, true); // error.message should be translated
            }
        }
    );
}

// 导出有效密钥
async function exportValidKeys() {
    const getValidKeysFailError = translations.admin_js_get_valid_keys_fail || "Failed to get valid keys";
    try {
        const response = await fetch("/admin/api/keys?filter=valid");

        if (!response.ok) {
            throw new Error(getValidKeysFailError);
        }

        const result = await response.json();

        if (result.success) {
            const keys = result.data.map(k => k.key).join("\n");

            if (keys.length === 0) {
                showToast(translations.admin_js_toast_no_valid_keys_found || "No valid keys found.", true);
                return;
            }

            const blob = new Blob([keys], { type: "text/plain" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `valid_keys_${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();

            URL.revokeObjectURL(url);
        } else {
            throw new Error(result.message || getValidKeysFailError);
        }
    } catch (error) {
        console.error("Error exporting valid keys:", error); // Non-user facing
        showToast(error.message, true); // error.message should be translated
    }
}

// 显示余额过滤模态框
function showBalanceFilterModal() {
    showModal({
        title: translations.admin_js_export_high_balance_modal_title_specific || "Export High Balance Keys",
        message: translations.admin_js_export_high_balance_modal_prompt || "Enter the minimum balance. Keys with balance greater than or equal to this value will be exported.",
        input: true,
        inputType: "number",
        placeholder: translations.admin_js_example_10_placeholder || "e.g., 10",
        value: "10",
        confirmText: translations.admin_js_export_button_modal || "Export",
        callback: value => {
            const minBalance = parseFloat(value);
            if (isNaN(minBalance) || minBalance < 0) {
                showToast(translations.admin_js_toast_enter_valid_balance || "Please enter a valid balance value.", true);
                return;
            }

            exportKeysWithMinBalance(minBalance);
        },
    });
}

// 导出高余额密钥
async function exportKeysWithMinBalance(minBalance) {
    const getHighBalanceKeysFailError = translations.admin_js_get_high_balance_keys_fail || "Failed to get high balance keys";
    try {
        const response = await fetch(`/admin/api/keys?filter=min_balance&value=${minBalance}`);

        if (!response.ok) {
            throw new Error(getHighBalanceKeysFailError);
        }

        const result = await response.json();

        if (result.success) {
            const keys = result.data.map(k => k.key).join("\n");

            if (keys.length === 0) {
                showToast((translations.admin_js_toast_no_keys_found_min_balance || "No keys found with balance >= {{minBalance}}.").replace("{{minBalance}}", minBalance), true);
                return;
            }

            const blob = new Blob([keys], { type: "text/plain" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `keys_min_balance_${minBalance}_${new Date()
                .toISOString()
                .slice(0, 10)}.txt`;
            a.click();

            URL.revokeObjectURL(url);

            showToast((translations.admin_js_toast_keys_exported_min_balance || "Exported {{count}} keys with balance >= {{minBalance}}.")
                .replace("{{count}}", result.data.length)
                .replace("{{minBalance}}", minBalance));
        } else {
            throw new Error(result.message || getHighBalanceKeysFailError);
        }
    } catch (error) {
        console.error("Error exporting high balance keys:", error); // Non-user facing
        showToast(error.message, true); // error.message should be translated
    }
}

// 导出过滤后的密钥
function exportFilteredKeys() {
    const searchQuery = document.getElementById("search-input").value.trim();

    if (!searchQuery) {
        showToast(translations.admin_js_toast_enter_search_criteria || "Please enter search criteria first.", true);
        return;
    }

    exportKeysWithFilter(searchQuery);
}

// 导出带过滤条件的密钥
async function exportKeysWithFilter(filter) {
    const getFilteredKeysFailError = translations.admin_js_get_filtered_keys_fail || "Failed to get filtered keys";
    try {
        const response = await fetch(
            `/admin/api/keys?search=${encodeURIComponent(filter)}&limit=1000`
        );

        if (!response.ok) {
            throw new Error(getFilteredKeysFailError);
        }

        const result = await response.json();

        if (result.success) {
            const keys = result.data.map(k => k.key).join("\n");

            if (keys.length === 0) {
                showToast(translations.admin_js_toast_no_matching_keys_found || "No matching keys found.", true);
                return;
            }

            const blob = new Blob([keys], { type: "text/plain" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `filtered_keys_${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();

            URL.revokeObjectURL(url);

            showToast((translations.admin_js_toast_keys_exported_filter || "Exported {{count}} matching keys.").replace("{{count}}", result.data.length));
        } else {
            throw new Error(result.message || getFilteredKeysFailError);
        }
    } catch (error) {
        console.error("Error exporting filtered keys:", error); // Non-user facing
        showToast(error.message, true); // error.message should be translated
    }
}

// 增强批量配置面板可见性
function enhanceBatchConfigPanelVisibility() {
    const configButton = document.getElementById("toggle-batch-config");
    const configPanel = document.getElementById("batch-config-panel");

    if (!configButton || !configPanel) return;

    // 如果用户曾经展开过配置面板，记住这个状态
    const wasExpanded = localStorage.getItem("batch_config_expanded") === "true";

    if (wasExpanded) {
        configPanel.classList.add("show");
        configButton.classList.add("active");

        // 更新按钮文本和图标
        const btnText = configButton.querySelector("span");
        const btnIcon = configButton.querySelector("svg");

        if (btnText) btnText.textContent = "点击收起";
        if (btnIcon) btnIcon.style.transform = "rotate(180deg)";
    }

    // 监听配置面板的展开/折叠状态变化
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.attributeName === "class") {
                const isExpanded = configPanel.classList.contains("show");
                localStorage.setItem("batch_config_expanded", isExpanded);
            }
        });
    });

    observer.observe(configPanel, { attributes: true });
}
