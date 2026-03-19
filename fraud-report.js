/*
 * fraud-report.js — Interactive charts for the Fraud Report page
 * Uses Chart.js loaded from CDN with graceful fallback if unavailable.
 */

(function () {
    'use strict';

    // Load Chart.js from CDN then initialize charts
    function loadChartJs(callback) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.onload = callback;
        script.onerror = function () {
            // Graceful degradation: show message if CDN unavailable
            var containers = document.querySelectorAll('.chart-container');
            for (var i = 0; i < containers.length; i++) {
                var msg = document.createElement('p');
                msg.style.textAlign = 'center';
                msg.style.color = '#888888';
                msg.style.fontStyle = 'italic';
                msg.textContent = 'Charts require JavaScript and internet access. Data is available in the tables above and below.';
                containers[i].appendChild(msg);
            }
        };
        document.head.appendChild(script);
    }

    function isDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function getTextColor() {
        return isDarkMode() ? '#eeeeee' : '#111111';
    }

    function getGridColor() {
        return isDarkMode() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    }

    function initCharts() {
        var textColor = getTextColor();
        var gridColor = getGridColor();

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = 'Arial, Helvetica, sans-serif';
        Chart.defaults.font.size = 12;

        // ---------------------------------------------------------------
        // Chart 1: Federal Improper Payments by Fiscal Year
        // ---------------------------------------------------------------
        var ipCtx = document.getElementById('improperPaymentsChart');
        if (ipCtx) {
            new Chart(ipCtx, {
                type: 'bar',
                data: {
                    labels: ['FY2015', 'FY2016', 'FY2017', 'FY2018', 'FY2019', 'FY2020', 'FY2021', 'FY2022', 'FY2023', 'FY2024', 'FY2025'],
                    datasets: [{
                        label: 'Improper Payments ($B)',
                        data: [136.7, 144.3, 141.2, 151.3, 175.0, 206.1, 281.4, 247.0, 236.0, 162.0, 186.0],
                        backgroundColor: [
                            '#4477aa', '#4477aa', '#4477aa', '#4477aa', '#4477aa',
                            '#cc4400', '#cc0000', '#cc4400', '#cc4400',
                            '#4477aa', '#cc4400'
                        ],
                        borderColor: '#111111',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Federal Improper Payments by Fiscal Year ($ Billions)',
                            color: textColor,
                            font: { size: 14, weight: 'bold' }
                        },
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    return '$' + ctx.parsed.y.toFixed(1) + 'B';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Billions USD',
                                color: textColor
                            },
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        },
                        x: {
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        }
                    }
                }
            });
        }

        // ---------------------------------------------------------------
        // Chart 2: Consumer Fraud Losses (FTC) by Year
        // ---------------------------------------------------------------
        var cfCtx = document.getElementById('consumerFraudChart');
        if (cfCtx) {
            new Chart(cfCtx, {
                type: 'line',
                data: {
                    labels: ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'],
                    datasets: [
                        {
                            label: 'FTC Consumer Fraud Losses ($B)',
                            data: [1.6, 1.9, 2.1, 2.6, 3.3, 4.8, 5.9, 8.8, 10.0, 12.5],
                            borderColor: '#cc4400',
                            backgroundColor: 'rgba(204,68,0,0.1)',
                            borderWidth: 2,
                            pointRadius: 5,
                            fill: true,
                            tension: 0.3
                        },
                        {
                            label: 'FBI IC3 Internet Crime Losses ($B)',
                            data: [1.07, 1.45, 1.42, 2.71, 3.50, 4.20, 6.90, 10.30, 12.50, 16.60],
                            borderColor: '#0055aa',
                            backgroundColor: 'rgba(0,85,170,0.05)',
                            borderWidth: 2,
                            pointRadius: 5,
                            fill: false,
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Consumer Fraud Losses by Year ($ Billions)',
                            color: textColor,
                            font: { size: 14, weight: 'bold' }
                        },
                        legend: {
                            labels: { color: textColor }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    return ctx.dataset.label + ': $' + ctx.parsed.y.toFixed(2) + 'B';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Billions USD',
                                color: textColor
                            },
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        },
                        x: {
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        }
                    }
                }
            });
        }

        // ---------------------------------------------------------------
        // Chart 3: COVID-19 Fraud by Program
        // ---------------------------------------------------------------
        var covidCtx = document.getElementById('covidFraudChart');
        if (covidCtx) {
            new Chart(covidCtx, {
                type: 'bar',
                data: {
                    labels: ['Unemployment\nInsurance (UI)', 'PPP Loans', 'COVID-19 EIDL', 'Other Programs'],
                    datasets: [
                        {
                            label: 'Total Disbursed ($B)',
                            data: [878, 800, 413, 500],
                            backgroundColor: 'rgba(68,119,170,0.7)',
                            borderColor: '#4477aa',
                            borderWidth: 1
                        },
                        {
                            label: 'Estimated Fraud ($B)',
                            data: [117, 64, 136, 15],
                            backgroundColor: 'rgba(204,68,0,0.85)',
                            borderColor: '#cc4400',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'COVID-19 Relief Programs: Total Disbursed vs. Estimated Fraud ($ Billions)',
                            color: textColor,
                            font: { size: 14, weight: 'bold' }
                        },
                        legend: {
                            labels: { color: textColor }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    return ctx.dataset.label + ': $' + ctx.parsed.y + 'B';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Billions USD',
                                color: textColor
                            },
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        },
                        x: {
                            ticks: {
                                color: textColor,
                                maxRotation: 0
                            },
                            grid: { color: gridColor }
                        }
                    }
                }
            });
        }

        // ---------------------------------------------------------------
        // Chart 4: Voting Records — Grouped Bar Chart per Bill
        // ---------------------------------------------------------------
        var votingCtx = document.getElementById('votingChart');
        if (votingCtx) {
            new Chart(votingCtx, {
                type: 'bar',
                data: {
                    labels: [
                        'EIDL Fraud Act\n(Jun 2022)',
                        'SS Fraud Act\n(Jan 2024)',
                        'UI Fraud Enforcement\n(Mar 2025)',
                        'Deporting Fraudsters\n(Mar 2026)'
                    ],
                    datasets: [
                        {
                            label: 'Republican Yea',
                            data: [203, 217, 212, 211],
                            backgroundColor: 'rgba(204,0,0,0.85)',
                            borderColor: '#cc0000',
                            borderWidth: 1
                        },
                        {
                            label: 'Republican Nay',
                            data: [0, 0, 0, 0],
                            backgroundColor: 'rgba(204,0,0,0.25)',
                            borderColor: '#cc0000',
                            borderWidth: 1
                        },
                        {
                            label: 'Democrat Yea',
                            data: [213, 55, 83, 20],
                            backgroundColor: 'rgba(0,85,170,0.85)',
                            borderColor: '#0055aa',
                            borderWidth: 1
                        },
                        {
                            label: 'Democrat Nay',
                            data: [3, 155, 127, 186],
                            backgroundColor: 'rgba(0,85,170,0.25)',
                            borderColor: '#0055aa',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'House Votes on Anti-Fraud Bills by Party (2022–2026)',
                            color: textColor,
                            font: { size: 14, weight: 'bold' }
                        },
                        legend: {
                            labels: { color: textColor }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Votes',
                                color: textColor
                            },
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        },
                        x: {
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        }
                    }
                }
            });
        }

        // ---------------------------------------------------------------
        // Chart 5: Party Support Rate Comparison
        // ---------------------------------------------------------------
        var pcCtx = document.getElementById('partyComparisonChart');
        if (pcCtx) {
            new Chart(pcCtx, {
                type: 'bar',
                data: {
                    labels: [
                        'EIDL Fraud Act\n(Jun 2022)',
                        'SS Fraud Act\n(Jan 2024)',
                        'UI Fraud Enforcement\n(Mar 2025)',
                        'Deporting Fraudsters\n(Mar 2026)'
                    ],
                    datasets: [
                        {
                            label: 'Republican Support Rate (%)',
                            data: [100, 100, 100, 100],
                            backgroundColor: 'rgba(204,0,0,0.8)',
                            borderColor: '#cc0000',
                            borderWidth: 1
                        },
                        {
                            label: 'Democrat Support Rate (%)',
                            data: [99, 26, 40, 10],
                            backgroundColor: 'rgba(0,85,170,0.8)',
                            borderColor: '#0055aa',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Party Support Rate for Anti-Fraud Bills (%)',
                            color: textColor,
                            font: { size: 14, weight: 'bold' }
                        },
                        legend: {
                            labels: { color: textColor }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    return ctx.dataset.label + ': ' + ctx.parsed.y + '%';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 110,
                            title: {
                                display: true,
                                text: 'Support Rate (%)',
                                color: textColor
                            },
                            ticks: {
                                color: textColor,
                                callback: function (val) { return val + '%'; }
                            },
                            grid: { color: gridColor }
                        },
                        x: {
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        }
                    }
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            loadChartJs(initCharts);
        });
    } else {
        loadChartJs(initCharts);
    }

})();
