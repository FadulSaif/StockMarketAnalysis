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
        initializeAnnotationTools();
        
        if (!window.stockData || typeof window.stockData !== 'object') {
            ErrorHandler.showError('Stock data failed to load. Please refresh the page.');
            return;
        }
        
        // ErrorHandler.showSuccess('Application loaded successfully');
    } catch (error) {
        ErrorHandler.showError(`Failed to initialize application: ${error.message}`);
    }
});

// Event listeners setup
function initializeEventListeners() {
    try {
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('stockSearch');
        const timeframeBtns = document.querySelectorAll('.timeframe-btn');
        const indicatorCheckboxes = document.querySelectorAll('.indicator-controls input[type="checkbox"]');
        const errorModal = document.getElementById('errorModal');
        const closeModal = document.querySelector('.close');

        if (!searchBtn || !searchInput || !errorModal || !closeModal) {
            throw new Error('Required DOM elements not found');
        }

        // Search functionality
        searchBtn.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });

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
                    // ErrorHandler.showSuccess(`Successfully loaded data for ${stock.name}`);
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
function getFilteredData(data, period) {
    try {
        if (!Array.isArray(data)) {
            throw new Error('Data must be an array');
        }
        if (period <= 0) {
            throw new Error('Period must be positive');
        }
        const sortedData = data.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        if (sortedData.length === 0) return [];
        const endDate = new Date(sortedData[sortedData.length - 1].date);
        let startDate;
        if (period === 365) {
            // 1 year
            startDate = new Date(endDate);
            startDate.setFullYear(endDate.getFullYear() - 1);
        } else if (period === 180) {
            // 6 months
            startDate = new Date(endDate);
            startDate.setMonth(endDate.getMonth() - 6);
        } else if (period === 90) {
            // 3 months
            startDate = new Date(endDate);
            startDate.setMonth(endDate.getMonth() - 3);
        } else if (period === 30) {
            // 1 month
            startDate = new Date(endDate);
            startDate.setMonth(endDate.getMonth() - 1);
        } else {
            // fallback: last N points
            return sortedData.slice(-period);
        }
        // Set startDate to the first day of the month for clarity
        startDate.setDate(1);
        // Filter data inclusively from startDate to endDate
        return sortedData.filter(d => {
            const dDate = new Date(d.date);
            return dDate >= startDate && dDate <= endDate;
        });
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
        const filteredData = getFilteredData(currentStock.historicalData, currentPeriod); // Use selected period
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

// Chart configuration and data processing
function createChartConfig(data) {
    const chartData = {
        datasets: [{
            type: 'candlestick',
            label: 'Price',
            data: data.map(d => ({
                x: new Date(d.date),
                o: d.open,
                h: d.high,
                l: d.low,
                c: d.close
            })),
            color: {
                up: '#4ade80',
                down: '#f87171',
                unchanged: '#60a5fa'
            },
            borderColor: {
                up: '#4ade80',
                down: '#f87171',
                unchanged: '#60a5fa'
            },
            borderWidth: 1
        }]
    };

    const config = {
        type: 'candlestick',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                },
                annotation: {
                    annotations: {}
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `Open: $${point.o.toFixed(2)}`,
                                `High: $${point.h.toFixed(2)}`,
                                `Low: $${point.l.toFixed(2)}`,
                                `Close: $${point.c.toFixed(2)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    position: 'right',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    };

    return config;
}

// Annotation handling
let activeAnnotationTool = null;
let annotations = {};

function initializeAnnotationTools() {
    const horizontalLineBtn = document.getElementById('horizontalLineBtn');
    const verticalLineBtn = document.getElementById('verticalLineBtn');
    const drawLineBtn = document.getElementById('drawLineBtn');
    const markerBtn = document.getElementById('markerBtn');
    const clearAnnotationsBtn = document.getElementById('clearAnnotationsBtn');
    horizontalLineBtn.addEventListener('click', () => toggleAnnotationTool('horizontal'));
    verticalLineBtn.addEventListener('click', () => toggleAnnotationTool('vertical'));
    if (drawLineBtn) drawLineBtn.addEventListener('click', () => toggleAnnotationTool('draw'));
    if (markerBtn) markerBtn.addEventListener('click', () => toggleAnnotationTool('marker'));
    clearAnnotationsBtn.addEventListener('click', clearAllAnnotations);
    // Add mouse event handlers for freeform drawing
    const chartContainer = document.querySelector('.chart-container');
    chartContainer.addEventListener('mousedown', handleChartMouseDown);
    chartContainer.addEventListener('mouseup', handleChartMouseUp);
    chartContainer.addEventListener('mousemove', handleChartMouseMove);
    chartContainer.addEventListener('click', handleChartClick);
}

function toggleAnnotationTool(tool) {
    const buttons = document.querySelectorAll('.tool-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (activeAnnotationTool === tool) {
        activeAnnotationTool = null;
    } else {
        activeAnnotationTool = tool;
        document.getElementById(`${tool}LineBtn`).classList.add('active');
    }
}

function handleChartClick(event) {
    if (!activeAnnotationTool || !currentChart) return;
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const xValue = currentChart.scales.x.getValueForPixel(x);
    const yValue = currentChart.scales.y.getValueForPixel(y);
    if (activeAnnotationTool === 'horizontal') {
        addHorizontalLine(yValue);
    } else if (activeAnnotationTool === 'vertical') {
        addVerticalLine(xValue);
    } else if (activeAnnotationTool === 'marker') {
        addMarker(xValue, yValue);
    }
}

function addHorizontalLine(value) {
    const id = `hline-${Date.now()}`;
    annotations[id] = {
        type: 'line',
        yMin: value,
        yMax: value,
        borderColor: '#60a5fa',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
            content: `$${value.toFixed(2)}`,
            enabled: true,
            position: 'start'
        }
    };
    updateAnnotations();
}

function addVerticalLine(value) {
    const id = `vline-${Date.now()}`;
    annotations[id] = {
        type: 'line',
        xMin: value,
        xMax: value,
        borderColor: '#60a5fa',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
            content: new Date(value).toLocaleDateString(),
            enabled: true,
            position: 'start'
        }
    };
    updateAnnotations();
}

function addMarker(x, y) {
    const id = `marker-${Date.now()}`;
    const label = prompt('Enter marker label (e.g., Buy, Sell, Note):', '');
    annotations[id] = {
        type: 'point',
        xValue: x,
        yValue: y,
        backgroundColor: '#f87171',
        radius: 6,
        label: {
            content: label || '●',
            enabled: true,
            position: 'center',
            color: '#fff',
            backgroundColor: '#1e40af',
            font: { weight: 'bold' }
        }
    };
    updateAnnotations();
}

function clearAllAnnotations() {
    annotations = {};
    updateAnnotations();
}

function updateAnnotations() {
    if (currentChart) {
        currentChart.options.plugins.annotation.annotations = annotations;
        currentChart.update();
    }
}

// Enhanced prediction with technical indicators
function calculatePrediction(data) {
    const prices = data.map(d => d.close);
    const rsi = calculateRSI(prices);
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    
    const lastPrice = prices[prices.length - 1];
    const lastRSI = rsi[rsi.length - 1];
    const lastSMA20 = sma20[sma20.length - 1];
    const lastSMA50 = sma50[sma50.length - 1];
    
    // Calculate trend strength
    let trendStrength = 0;
    
    // RSI contribution
    if (lastRSI > 70) trendStrength -= 2;
    else if (lastRSI < 30) trendStrength += 2;
    
    // Moving average contribution
    if (lastSMA20 > lastSMA50) trendStrength += 1;
    else if (lastSMA20 < lastSMA50) trendStrength -= 1;
    
    // Price momentum
    const priceChange = (lastPrice - prices[prices.length - 2]) / prices[prices.length - 2];
    trendStrength += priceChange * 10;
    
    // Calculate prediction
    const prediction = lastPrice * (1 + trendStrength * 0.01);
    
    // Determine confidence
    let confidence = 'Medium';
    if (Math.abs(trendStrength) > 3) confidence = 'High';
    else if (Math.abs(trendStrength) < 1) confidence = 'Low';
    
    return {
        prediction,
        confidence,
        trend: trendStrength > 0 ? 'Bullish' : trendStrength < 0 ? 'Bearish' : 'Neutral'
    };
}

// --- Freeform Line Drawing ---
// Add a new tool for freeform line drawing
let drawing = false;
let drawStart = null;
function handleChartMouseDown(event) {
    if (activeAnnotationTool !== 'draw' || !currentChart) return;
    drawing = true;
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const xValue = currentChart.scales.x.getValueForPixel(x);
    const yValue = currentChart.scales.y.getValueForPixel(y);
    drawStart = { x: xValue, y: yValue };
}
function handleChartMouseUp(event) {
    if (!drawing || activeAnnotationTool !== 'draw' || !currentChart) return;
    drawing = false;
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const xValue = currentChart.scales.x.getValueForPixel(x);
    const yValue = currentChart.scales.y.getValueForPixel(y);
    if (drawStart) {
        addFreeformLine(drawStart, { x: xValue, y: yValue });
        drawStart = null;
    }
}
function handleChartMouseMove(event) {
    // Optionally, show a preview while drawing
}
function addFreeformLine(start, end) {
    const id = `fline-${Date.now()}`;
    annotations[id] = {
        type: 'line',
        xMin: start.x,
        xMax: end.x,
        yMin: start.y,
        yMax: end.y,
        borderColor: '#fbbf24',
        borderWidth: 2,
        borderDash: [2, 2],
        label: {
            content: 'Custom',
            enabled: false
        }
    };
    updateAnnotations();
}