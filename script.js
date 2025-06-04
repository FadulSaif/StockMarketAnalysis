// Global variables
let currentStock = null;
let currentChart = null;
let volumeChart = null;
let currentPeriod = 30;
let currentChartType = 'line';

// Error handling class
class ErrorHandler {
    static showError(message, type = 'error') {
        console.error('Error:', message);
        
        // Remove any existing error messages
        this.clearMessages();
        
        // Create error element
        const errorDiv = document.createElement('div');
        errorDiv.className = `${type}-message`;
        errorDiv.textContent = message;
        
        // Insert at the top of the container
        const container = document.querySelector('.container');
        if (container && container.firstChild) {
            container.insertBefore(errorDiv, container.firstChild);
        }
        
        // Also show in modal for critical errors
        if (type === 'error') {
            document.getElementById('errorMessage').textContent = message;
            document.getElementById('errorModal').style.display = 'block';
        }
        
        // Auto-remove after 5 seconds for non-critical messages
        if (type !== 'error') {
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        }
    }
    
    static showWarning(message) {
        this.showError(message, 'warning');
    }
    
    static showSuccess(message) {
        this.showError(message, 'success');
    }
    
    static clearMessages() {
        const messages = document.querySelectorAll('.error-message, .warning-message, .success-message');
        messages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
    }
    
    static validateStockSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            throw new Error('Stock symbol must be a valid string');
        }
        
        if (symbol.trim().length === 0) {
            throw new Error('Stock symbol cannot be empty');
        }
        
        if (symbol.length > 10) {
            throw new Error('Stock symbol is too long (maximum 10 characters)');
        }
        
        if (!/^[A-Za-z]+$/.test(symbol.trim())) {
            throw new Error('Stock symbol can only contain letters');
        }
        
        return symbol.trim().toUpperCase();
    }
    
    static validateStockData(stock) {
        if (!stock || typeof stock !== 'object') {
            throw new Error('Invalid stock data format');
        }
        
        const requiredFields = ['symbol', 'name', 'currentPrice', 'historicalData'];
        for (const field of requiredFields) {
            if (!(field in stock)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        if (!Array.isArray(stock.historicalData)) {
            throw new Error('Historical data must be an array');
        }
        
        if (stock.historicalData.length === 0) {
            throw new Error('No historical data available');
        }
        
        // Validate historical data points
        stock.historicalData.forEach((point, index) => {
            const requiredPointFields = ['date', 'open', 'high', 'low', 'close', 'volume'];
            for (const field of requiredPointFields) {
                if (!(field in point)) {
                    throw new Error(`Missing field ${field} in data point ${index}`);
                }
            }
            
            if (isNaN(point.open) || isNaN(point.high) || isNaN(point.low) || isNaN(point.close) || isNaN(point.volume)) {
                throw new Error(`Invalid numeric data in data point ${index}`);
            }
            
            if (point.high < point.low) {
                throw new Error(`Invalid price data: high < low in data point ${index}`);
            }
        });
        
        return true;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Stock Analysis Dashboard loaded');
    try {
        initializeEventListeners();
        setupChartDefaults();
        
        // Validate that stock data is loaded
        if (!window.stockData || typeof window.stockData !== 'object') {
            ErrorHandler.showError('Stock data failed to load. Please refresh the page.');
            return;
        }
        
        ErrorHandler.showSuccess('Application loaded successfully');
    } catch (error) {
        ErrorHandler.showError(`Failed to initialize application: ${error.message}`);
    }
});

// Event listeners setup
function initializeEventListeners() {
    try {
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('stockSearch');
        const lineChartBtn = document.getElementById('lineChartBtn');
        const candlestickBtn = document.getElementById('candlestickBtn');
        const timeframeBtns = document.querySelectorAll('.timeframe-btn');
        const indicatorCheckboxes = document.querySelectorAll('.indicator-controls input[type="checkbox"]');
        const errorModal = document.getElementById('errorModal');
        const closeModal = document.querySelector('.close');

        if (!searchBtn || !searchInput || !lineChartBtn || !candlestickBtn || !errorModal || !closeModal) {
            throw new Error('Required DOM elements not found');
        }

        // Search functionality
        searchBtn.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });

        // Chart type selection
        lineChartBtn.addEventListener('click', () => selectChartType('line'));
        candlestickBtn.addEventListener('click', () => selectChartType('candlestick'));

        // Timeframe selection
        timeframeBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                try {
                    timeframeBtns.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    const period = parseInt(this.dataset.period);
                    if (isNaN(period) || period <= 0) {
                        throw new Error('Invalid timeframe period');
                    }
                    currentPeriod = period;
                    if (currentStock) {
                        updateChart();
                    }
                } catch (error) {
                    ErrorHandler.showError(`Failed to change timeframe: ${error.message}`);
                }
            });
        });

        // Technical indicators
        indicatorCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                try {
                    if (currentStock) {
                        updateChart();
                    }
                } catch (error) {
                    ErrorHandler.showError(`Failed to update indicators: ${error.message}`);
                }
            });
        });

        // Modal close
        closeModal.addEventListener('click', () => {
            errorModal.style.display = 'none';
        });

        window.addEventListener('click', function(e) {
            if (e.target === errorModal) {
                errorModal.style.display = 'none';
            }
        });
    } catch (error) {
        ErrorHandler.showError(`Failed to initialize event listeners: ${error.message}`);
    }
}

// Chart.js defaults
function setupChartDefaults() {
    try {
        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js library not loaded');
        }
        
        Chart.defaults.responsive = true;
        Chart.defaults.maintainAspectRatio = false;
        Chart.defaults.plugins.legend.display = true;
        Chart.defaults.plugins.tooltip.enabled = true;
        Chart.defaults.color = '#ffffff';
        Chart.defaults.borderColor = '#444';
        Chart.defaults.backgroundColor = '#000';
    } catch (error) {
        ErrorHandler.showError(`Failed to setup chart defaults: ${error.message}`);
    }
}

// Handle stock search
function handleSearch() {
    try {
        const searchTerm = document.getElementById('stockSearch').value;
        
        if (!searchTerm) {
            ErrorHandler.showWarning('Please enter a stock symbol');
            return;
        }
        
        const validatedSymbol = ErrorHandler.validateStockSymbol(searchTerm);
        console.log('Searching for stock:', validatedSymbol);
        
        showLoading(true);
        ErrorHandler.clearMessages();
        
        // Simulate API delay with error handling
        setTimeout(() => {
            try {
                const stock = findStock(validatedSymbol);
                if (stock) {
                    ErrorHandler.validateStockData(stock);
                    displayStock(stock);
                    ErrorHandler.showSuccess(`Successfully loaded data for ${stock.name}`);
                } else {
                    const availableStocks = Object.keys(window.stockData || {}).join(', ');
                    ErrorHandler.showError(`Stock symbol "${validatedSymbol}" not found. Available stocks: ${availableStocks}`);
                }
            } catch (error) {
                ErrorHandler.showError(`Search failed: ${error.message}`);
            } finally {
                showLoading(false);
            }
        }, 1000);
    } catch (error) {
        showLoading(false);
        ErrorHandler.showError(`Search error: ${error.message}`);
    }
}

// Find stock in data
function findStock(symbol) {
    try {
        console.log('Looking for stock symbol:', symbol);
        
        if (!window.stockData || typeof window.stockData !== 'object') {
            throw new Error('Stock data not available');
        }
        
        console.log('Available stocks:', Object.keys(window.stockData));
        
        if (window.stockData[symbol]) {
            return window.stockData[symbol];
        }
        
        // Try partial matching
        for (let key in window.stockData) {
            if (key.includes(symbol) || 
                (window.stockData[key].name && window.stockData[key].name.toUpperCase().includes(symbol))) {
                return window.stockData[key];
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error finding stock:', error);
        return null;
    }
}

// Display stock information
function displayStock(stock) {
    try {
        console.log('Displaying stock:', stock);
        
        ErrorHandler.validateStockData(stock);
        currentStock = stock;
        
        // Update stock info with error handling
        const stockNameEl = document.getElementById('stockName');
        const stockSymbolEl = document.getElementById('stockSymbol');
        const currentPriceEl = document.getElementById('currentPrice');
        
        if (!stockNameEl || !stockSymbolEl || !currentPriceEl) {
            throw new Error('Required stock info elements not found');
        }
        
        stockNameEl.textContent = stock.name;
        stockSymbolEl.textContent = stock.symbol;
        currentPriceEl.textContent = `$${stock.currentPrice.toFixed(2)}`;
        
        // Calculate price change with error handling
        try {
            const historicalData = getFilteredData(stock.historicalData, currentPeriod);
            if (historicalData.length > 1) {
                const previousClose = historicalData[historicalData.length - 2].close;
                const currentPrice = stock.currentPrice;
                const change = currentPrice - previousClose;
                const changePercent = (change / previousClose) * 100;
                
                const priceChangeElement = document.getElementById('priceChange');
                if (priceChangeElement) {
                    priceChangeElement.textContent = `${change >= 0 ? '+' : ''}$${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
                    priceChangeElement.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
                }
            }
        } catch (error) {
            console.warn('Could not calculate price change:', error.message);
        }
        
        // Show stock info panel
        const stockInfoEl = document.getElementById('stockInfo');
        if (stockInfoEl) {
            stockInfoEl.style.display = 'block';
        }
        
        // Update charts and indicators
        updateChart();
        updateTechnicalIndicators();
        updatePrediction();
        
    } catch (error) {
        ErrorHandler.showError(`Failed to display stock: ${error.message}`);
    }
}

// Get filtered historical data based on selected period
function getFilteredData(data, days) {
    try {
        if (!Array.isArray(data)) {
            throw new Error('Data must be an array');
        }
        
        if (days <= 0) {
            throw new Error('Days must be positive');
        }
        
        const sortedData = data.sort((a, b) => new Date(a.date) - new Date(b.date));
        return sortedData.slice(-days);
    } catch (error) {
        console.error('Error filtering data:', error);
        return [];
    }
}

// Update main chart
function updateChart() {
    if (!currentStock) {
        ErrorHandler.showWarning('No stock selected');
        return;
    }
    
    try {
        const ctx = document.getElementById('mainChart')?.getContext('2d');
        const volumeCtx = document.getElementById('volumeChart')?.getContext('2d');
        
        if (!ctx || !volumeCtx) {
            throw new Error('Chart canvas elements not found');
        }
        
        // Destroy existing charts safely
        if (currentChart) {
            try {
                currentChart.destroy();
            } catch (e) {
                console.warn('Error destroying main chart:', e);
            }
        }
        if (volumeChart) {
            try {
                volumeChart.destroy();
            } catch (e) {
                console.warn('Error destroying volume chart:', e);
            }
        }
        
        const filteredData = getFilteredData(currentStock.historicalData, currentPeriod);
        if (filteredData.length === 0) {
            throw new Error('No data available for selected period');
        }
        
        console.log(`Displaying ${filteredData.length} data points for ${currentPeriod} days`);
        
        // Prepare data with validation
        const labels = filteredData.map(d => {
            if (!d.date) throw new Error('Missing date in data point');
            return d.date;
        });
        const prices = filteredData.map(d => {
            if (isNaN(d.close)) throw new Error('Invalid price data');
            return d.close;
        });
        const volumes = filteredData.map(d => {
            if (isNaN(d.volume)) throw new Error('Invalid volume data');
            return d.volume;
        });
        
        // Create main chart
        const chartData = {
            labels: labels,
            datasets: [{
                label: `${currentStock.symbol} Price`,
                data: prices,
                borderColor: '#3b82f6',
                backgroundColor: currentChartType === 'line' ? 'rgba(59, 130, 246, 0.1)' : '#3b82f6',
                borderWidth: 2,
                fill: currentChartType === 'line',
                tension: 0.1
            }]
        };
        
        // Add technical indicators
        addTechnicalIndicators(chartData, filteredData);
        
        // Chart configuration
        const config = {
            type: currentChartType === 'candlestick' ? 'bar' : 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        },
                        title: {
                            display: true,
                            text: 'Date',
                            color: '#fff'
                        },
                        ticks: {
                            color: '#fff'
                        },
                        grid: {
                            color: '#333'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Price ($)',
                            color: '#fff'
                        },
                        ticks: {
                            color: '#fff'
                        },
                        grid: {
                            color: '#333'
                        }
                    }
                },
                plugins: {
                    zoom: {
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                        },
                        pan: {
                            enabled: true,
                            mode: 'x',
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#fff'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#3b82f6',
                        borderWidth: 1
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        };
        
        currentChart = new Chart(ctx, config);
        
        // Create volume chart
        const volumeConfig = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Volume',
                    data: volumes,
                    backgroundColor: '#1e40af',
                    borderColor: '#3b82f6',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        },
                        ticks: {
                            color: '#fff'
                        },
                        grid: {
                            color: '#333'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Volume',
                            color: '#fff'
                        },
                        ticks: {
                            color: '#fff'
                        },
                        grid: {
                            color: '#333'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#3b82f6',
                        borderWidth: 1
                    }
                }
            }
        };
        
        volumeChart = new Chart(volumeCtx, volumeConfig);
        
    } catch (error) {
        ErrorHandler.showError(`Failed to update chart: ${error.message}`);
    }
}

// Add technical indicators to chart
function addTechnicalIndicators(chartData, data) {
    try {
        const prices = data.map(d => d.close);
        
        // SMA 20
        if (document.getElementById('sma20')?.checked) {
            const sma20 = calculateSMA(prices, 20);
            chartData.datasets.push({
                label: 'SMA 20',
                data: sma20,
                borderColor: '#ff6b6b',
                backgroundColor: 'transparent',
                borderWidth: 2,
                fill: false,
                tension: 0.1
            });
        }
        
        // SMA 50
        if (document.getElementById('sma50')?.checked) {
            const sma50 = calculateSMA(prices, 50);
            chartData.datasets.push({
                label: 'SMA 50',
                data: sma50,
                borderColor: '#4ecdc4',
                backgroundColor: 'transparent',
                borderWidth: 2,
                fill: false,
                tension: 0.1
            });
        }
        
        // EMA 12
        if (document.getElementById('ema12')?.checked) {
            const ema12 = calculateEMA(prices, 12);
            chartData.datasets.push({
                label: 'EMA 12',
                data: ema12,
                borderColor: '#45b7d1',
                backgroundColor: 'transparent',
                borderWidth: 2,
                fill: false,
                tension: 0.1
            });
        }
    } catch (error) {
        console.error('Error adding technical indicators:', error);
    }
}

// Calculate Simple Moving Average
function calculateSMA(prices, period) {
    try {
        if (!Array.isArray(prices) || prices.length === 0) {
            throw new Error('Invalid prices array');
        }
        
        if (period <= 0 || period > prices.length) {
            throw new Error('Invalid period for SMA calculation');
        }
        
        const sma = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) {
                sma.push(null);
            } else {
                const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => {
                    if (isNaN(a) || isNaN(b)) throw new Error('Invalid price data for SMA');
                    return a + b;
                }, 0);
                sma.push(sum / period);
            }
        }
        return sma;
    } catch (error) {
        console.error('Error calculating SMA:', error);
        return [];
    }
}

// Calculate Exponential Moving Average
function calculateEMA(prices, period) {
    try {
        if (!Array.isArray(prices) || prices.length === 0) {
            throw new Error('Invalid prices array');
        }
        
        if (period <= 0) {
            throw new Error('Invalid period for EMA calculation');
        }
        
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        for (let i = 0; i < prices.length; i++) {
            if (isNaN(prices[i])) {
                throw new Error(`Invalid price data at index ${i}`);
            }
            
            if (i === 0) {
                ema.push(prices[i]);
            } else {
                ema.push((prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
            }
        }
        return ema;
    } catch (error) {
        console.error('Error calculating EMA:', error);
        return [];
    }
}

// Calculate RSI
function calculateRSI(prices, period = 14) {
    try {
        if (!Array.isArray(prices) || prices.length < period + 1) {
            throw new Error('Insufficient data for RSI calculation');
        }
        
        const gains = [];
        const losses = [];
        
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }
        
        if (gains.length < period || losses.length < period) {
            throw new Error('Insufficient gain/loss data for RSI');
        }
        
        let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        if (avgLoss === 0) {
            return 100;
        }
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    } catch (error) {
        console.error('Error calculating RSI:', error);
        return 50; // Return neutral RSI on error
    }
}

// Calculate MACD
function calculateMACD(prices) {
    try {
        if (!Array.isArray(prices) || prices.length < 26) {
            throw new Error('Insufficient data for MACD calculation');
        }
        
        const ema12 = calculateEMA(prices, 12);
        const ema26 = calculateEMA(prices, 26);
        
        if (ema12.length === 0 || ema26.length === 0) {
            throw new Error('Failed to calculate EMAs for MACD');
        }
        
        const macdLine = ema12.map((val, i) => val - ema26[i]);
        const signalLine = calculateEMA(macdLine.filter(val => !isNaN(val)), 9);
        
        if (signalLine.length === 0) {
            throw new Error('Failed to calculate signal line for MACD');
        }
        
        const histogram = macdLine.slice(-signalLine.length).map((val, i) => val - signalLine[i]);
        
        return {
            macd: macdLine[macdLine.length - 1] || 0,
            signal: signalLine[signalLine.length - 1] || 0,
            histogram: histogram[histogram.length - 1] || 0
        };
    } catch (error) {
        console.error('Error calculating MACD:', error);
        return { macd: 0, signal: 0, histogram: 0 };
    }
}

// Update technical indicators display
function updateTechnicalIndicators() {
    if (!currentStock) return;
    
    try {
        const filteredData = getFilteredData(currentStock.historicalData, currentPeriod);
        if (filteredData.length === 0) {
            throw new Error('No data available for indicators');
        }
        
        const prices = filteredData.map(d => d.close);
        
        // Update moving averages
        const sma20 = calculateSMA(prices, 20);
        const sma50 = calculateSMA(prices, 50);
        const ema12 = calculateEMA(prices, 12);
        
        const sma20El = document.getElementById('sma20Value');
        const sma50El = document.getElementById('sma50Value');
        const ema12El = document.getElementById('ema12Value');
        
        if (sma20El) sma20El.textContent = `$${(sma20[sma20.length - 1] || 0).toFixed(2)}`;
        if (sma50El) sma50El.textContent = `$${(sma50[sma50.length - 1] || 0).toFixed(2)}`;
        if (ema12El) ema12El.textContent = `$${(ema12[ema12.length - 1] || 0).toFixed(2)}`;
        
        // Update RSI
        const rsi = calculateRSI(prices);
        const rsiValueEl = document.getElementById('rsiValue');
        const rsiBarEl = document.getElementById('rsiBar');
        
        if (rsiValueEl) rsiValueEl.textContent = rsi.toFixed(2);
        if (rsiBarEl) rsiBarEl.style.left = `${Math.max(0, Math.min(100, rsi))}%`;
        
        // Update MACD
        const macd = calculateMACD(prices);
        const macdValueEl = document.getElementById('macdValue');
        const macdSignalEl = document.getElementById('macdSignal');
        const macdHistogramEl = document.getElementById('macdHistogram');
        
        if (macdValueEl) macdValueEl.textContent = macd.macd.toFixed(4);
        if (macdSignalEl) macdSignalEl.textContent = macd.signal.toFixed(4);
        if (macdHistogramEl) macdHistogramEl.textContent = macd.histogram.toFixed(4);
        
    } catch (error) {
        ErrorHandler.showError(`Failed to update technical indicators: ${error.message}`);
    }
}

// Linear regression for price prediction
function linearRegression(x, y) {
    try {
        if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length === 0) {
            throw new Error('Invalid input arrays for linear regression');
        }
        
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
        const sumXX = x.reduce((a, b) => a + b * b, 0);
        
        const denominator = n * sumXX - sumX * sumX;
        if (denominator === 0) {
            throw new Error('Cannot perform linear regression - division by zero');
        }
        
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        
        return { slope, intercept };
    } catch (error) {
        console.error('Error in linear regression:', error);
        return { slope: 0, intercept: 0 };
    }
}

// Update price prediction
function updatePrediction() {
    if (!currentStock) return;
    
    try {
        const filteredData = getFilteredData(currentStock.historicalData, 30); // Use last 30 days
        if (filteredData.length < 10) {
            throw new Error('Insufficient data for prediction (minimum 10 days required)');
        }
        
        const prices = filteredData.map(d => d.close);
        const x = prices.map((_, i) => i);
        
        const { slope, intercept } = linearRegression(x, prices);
        
        // Predict next day and next week
        const nextDay = slope * prices.length + intercept;
        const nextWeek = slope * (prices.length + 7) + intercept;
        
        const nextDayEl = document.getElementById('nextDayPrediction');
        const nextWeekEl = document.getElementById('nextWeekPrediction');
        
        if (nextDayEl) nextDayEl.textContent = `$${Math.max(0, nextDay).toFixed(2)}`;
        if (nextWeekEl) nextWeekEl.textContent = `$${Math.max(0, nextWeek).toFixed(2)}`;
        
        // Determine trend
        const trendElement = document.getElementById('trendDirection');
        if (trendElement) {
            if (slope > 0.1) {
                trendElement.textContent = 'Bullish';
                trendElement.className = 'prediction-trend bullish';
            } else if (slope < -0.1) {
                trendElement.textContent = 'Bearish';
                trendElement.className = 'prediction-trend bearish';
            } else {
                trendElement.textContent = 'Neutral';
                trendElement.className = 'prediction-trend';
            }
        }
    } catch (error) {
        ErrorHandler.showError(`Failed to update prediction: ${error.message}`);
        
        // Set default values on error
        const nextDayEl = document.getElementById('nextDayPrediction');
        const nextWeekEl = document.getElementById('nextWeekPrediction');
        const trendElement = document.getElementById('trendDirection');
        
        if (nextDayEl) nextDayEl.textContent = '$0.00';
        if (nextWeekEl) nextWeekEl.textContent = '$0.00';
        if (trendElement) {
            trendElement.textContent = 'Unknown';
            trendElement.className = 'prediction-trend';
        }
    }
}

// Chart type selection
function selectChartType(type) {
    try {
        if (!['line', 'candlestick'].includes(type)) {
            throw new Error('Invalid chart type');
        }
        
        currentChartType = type;
        
        // Update button states
        const lineBtn = document.getElementById('lineChartBtn');
        const candlestickBtn = document.getElementById('candlestickBtn');
        
        if (lineBtn) lineBtn.classList.toggle('active', type === 'line');
        if (candlestickBtn) candlestickBtn.classList.toggle('active', type === 'candlestick');
        
        if (currentStock) {
            updateChart();
        }
    } catch (error) {
        ErrorHandler.showError(`Failed to select chart type: ${error.message}`);
    }
}

// Show/hide loading spinner
function showLoading(show) {
    try {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = show ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Error controlling loading spinner:', error);
    }
}

// Utility function to format numbers
function formatNumber(num) {
    try {
        if (isNaN(num) || num === null || num === undefined) {
            return '0';
        }
        
        if (num >= 1e9) {
            return (num / 1e9).toFixed(1) + 'B';
        } else if (num >= 1e6) {
            return (num / 1e6).toFixed(1) + 'M';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(1) + 'K';
        }
        return num.toString();
    } catch (error) {
        console.error('Error formatting number:', error);
        return '0';
    }
}

// Export functions for potential external use
window.StockAnalyzer = {
    displayStock,
    updateChart,
    calculateSMA,
    calculateEMA,
    calculateRSI,
    calculateMACD,
    linearRegression,
    ErrorHandler
};

console.log('Stock Analysis Dashboard script loaded successfully');