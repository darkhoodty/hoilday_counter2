// Korean Holiday Planner - Dashboard Controller

// Public Data Portal API Service Key (Decoded format)
const SERVICE_KEY = '02Esk57yanQ5IsHwio6g8Z4vtuWTcwZRWatt/+4xEEvBJzj+adaSN0uL+ukMqVoWF1SlgmhWZOUmA2tK4bREnA==';

// App State
const state = {
    selectedYear: 2026,
    selectedMonth: 6, // June (1-indexed)
    selectedDay: 1,   // 1st
    holidaysCache: {}, // Cache: { "2026": { "20260505": "어린이날", ... } }
    connectionMode: 'checking' // 'server', 'proxy', 'error'
};

// Elements
const el = {
    prevMonthBtn: document.getElementById('prev-month-btn'),
    nextMonthBtn: document.getElementById('next-month-btn'),
    yearSelect: document.getElementById('year-select'),
    monthSelect: document.getElementById('month-select'),
    todayBtn: document.getElementById('today-btn'),
    calendarGrid: document.getElementById('calendar-days-grid'),
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),

    // Detail panel
    selectedDayNum: document.getElementById('selected-day-num'),
    selectedFullDate: document.getElementById('selected-full-date'),
    selectedDayDesc: document.getElementById('selected-day-desc'),
    monthlyHolidayList: document.getElementById('monthly-holiday-list')
};

// Initialize App
async function init() {
    setupEventListeners();
    await detectConnectionMode();
    setToday();
}

// 1. Detect Connection Mode (Python Server vs Client-side CORS Proxy)
async function detectConnectionMode() {
    const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
    if (isLocal) {
        try {
            // Ping our python server API to see if it responds
            const res = await fetch('/api/holidays?year=2026&month=1');
            if (res.ok) {
                state.connectionMode = 'server';
                el.statusIndicator.className = 'status-indicator connected';
                el.statusText.textContent = '로컬 서버 연동 완료';
                return;
            }
        } catch (e) {
            console.warn('Local proxy test failed, falling back to CORS proxy.');
        }
    }

    // Fallback: Client-side CORS proxy
    state.connectionMode = 'proxy';
    el.statusIndicator.className = 'status-indicator proxy';
    el.statusText.textContent = 'CORS 프록시 우회 연동';
}

// Helper: Make API calls bypassing CORS
async function apiFetch(targetUrl) {
    if (state.connectionMode === 'server') {
        // Map target URL to our local API route
        const urlObj = new URL(targetUrl);
        const localUrl = `/api/holidays${urlObj.search}`;
        const res = await fetch(localUrl);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    } else {
        // Use AllOrigins proxy
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
    }
}

// 2. Event Listeners Setup
function setupEventListeners() {
    // Dropdowns
    el.yearSelect.addEventListener('change', (e) => {
        state.selectedYear = parseInt(e.target.value);
        updateCalendar();
    });
    el.monthSelect.addEventListener('change', (e) => {
        state.selectedMonth = parseInt(e.target.value);
        updateCalendar();
    });

    // Month navigation buttons
    el.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    el.nextMonthBtn.addEventListener('click', () => changeMonth(1));
    el.todayBtn.addEventListener('click', setToday);
}

// Change Month
function changeMonth(direction) {
    let month = state.selectedMonth + direction;
    let year = state.selectedYear;

    if (month < 1) {
        month = 12;
        year--;
    } else if (month > 12) {
        month = 1;
        year++;
    }

    state.selectedYear = year;
    state.selectedMonth = month;

    el.yearSelect.value = year;
    el.monthSelect.value = month;

    updateCalendar();
}

// Set calendar to Today's date
function setToday() {
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth() + 1;
    let day = today.getDate();

    // Default to June 2026 if today is outside our year options
    if (year < 2024 || year > 2027) {
        year = 2026;
        month = 6;
        day = 1;
    }

    state.selectedYear = year;
    state.selectedMonth = month;
    state.selectedDay = day;

    el.yearSelect.value = year;
    el.monthSelect.value = month;

    updateCalendar();
    selectDay(day);
}

// 3. Fetch Holidays for a Year
async function fetchHolidays(year) {
    const holidayMap = {};

    for (let month = 1; month <= 12; month++) {

        const url =
            `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo` +
            `?serviceKey=${encodeURIComponent(SERVICE_KEY)}` +
            `&solYear=${year}` +
            `&solMonth=${String(month).padStart(2, '0')}` +
            `&_type=json`;

        try {
            const data = await apiFetch(url);

            const items = data?.response?.body?.items?.item;

            if (!items) continue;

            const itemList = Array.isArray(items)
                ? items
                : [items];

            for (const item of itemList) {
                if (item.isHoliday === 'Y') {
                    holidayMap[String(item.locdate)] =
                        item.dateName;
                }
            }

        } catch (e) {
            console.error(e);
        }
    }

    state.holidaysCache[year] = holidayMap;
    return holidayMap;
}

// 4. Update Calendar Grid
async function updateCalendar() {
    // Fetch holidays first
    const holidays = await fetchHolidays(state.selectedYear);

    // Clear days
    el.calendarGrid.innerHTML = '';

    const year = state.selectedYear;
    const month = state.selectedMonth;

    // First day of current month
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    // Number of days in current month
    const numDays = new Date(year, month, 0).getDate();

    // 1. Fill previous month's overlapping days (empty space)
    for (let i = firstDayIndex; i > 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day empty';
        el.calendarGrid.appendChild(dayDiv);
    }

    // Today's comparison parameters
    const sysToday = new Date();
    const todayYear = sysToday.getFullYear();
    const todayMonth = sysToday.getMonth() + 1;
    const todayDay = sysToday.getDate();

    // 2. Fill current month's days
    for (let day = 1; day <= numDays; day++) {
        const dateStr = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, day).getDay();

        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.dataset.day = day;

        // Check day type classes
        if (dayOfWeek === 0) dayDiv.classList.add('sunday');
        else if (dayOfWeek === 6) dayDiv.classList.add('saturday');

        // Holiday check
        console.log("현재 달:", month);
        console.log("찾는 날짜:", dateStr);
        console.log("holiday:", holidays[dateStr]);

        const holidayName = holidays[dateStr];
        if (holidayName) {
            dayDiv.classList.add('holiday');
            const labelDiv = document.createElement('div');
            labelDiv.className = 'day-holiday-name';
            labelDiv.textContent = holidayName;
            labelDiv.title = holidayName;
            dayDiv.appendChild(labelDiv);
        }

        // Today check
        if (year === todayYear && month === todayMonth && day === todayDay) {
            dayDiv.classList.add('today');
        }

        // Selected check
        if (day === state.selectedDay) {
            dayDiv.classList.add('selected');
        }

        const numLabel = document.createElement('span');
        numLabel.className = 'day-number-label';
        numLabel.textContent = day;
        dayDiv.appendChild(numLabel);

        // Click action
        dayDiv.addEventListener('click', () => selectDay(day));

        el.calendarGrid.appendChild(dayDiv);
    }

    // Update Monthly Holiday list view in the sidebar
    updateMonthlyHolidayList(holidays);

    // Refresh icons
    lucide.createIcons();
}

// 5. Select a Day
function selectDay(day) {
    state.selectedDay = day;

    // Update selected class in DOM
    const days = el.calendarGrid.querySelectorAll('.calendar-day');
    days.forEach(d => {
        if (parseInt(d.dataset.day) === day) {
            d.classList.add('selected');
        } else {
            d.classList.remove('selected');
        }
    });

    // Update Detail Panel Text
    const year = state.selectedYear;
    const month = state.selectedMonth;
    const dateStr = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const dayOfWeekStr = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][new Date(year, month - 1, day).getDay()];

    el.selectedDayNum.textContent = day;
    el.selectedFullDate.textContent = `${year}년 ${month}월 ${day}일 (${dayOfWeekStr})`;

    const holidays = state.holidaysCache[year] || {};
    const holidayName = holidays[dateStr];

    if (holidayName) {
        el.selectedDayDesc.textContent = `공공지정 휴일: ${holidayName}`;
        el.selectedDayDesc.className = 'day-desc is-holiday';
    } else if (new Date(year, month - 1, day).getDay() === 0 || new Date(year, month - 1, day).getDay() === 6) {
        el.selectedDayDesc.textContent = '주말 (휴무일)';
        el.selectedDayDesc.className = 'day-desc is-holiday';
    } else {
        el.selectedDayDesc.textContent = '일반 평일';
        el.selectedDayDesc.className = 'day-desc';
    }
}

// 6. Update Monthly Holiday Summary List
function updateMonthlyHolidayList(holidays) {
    el.monthlyHolidayList.innerHTML = '';

    const monthStr = String(state.selectedMonth).padStart(2, '0');
    const monthHolidays = [];

    // Filter holidays for current year and month
    for (const [dateStr, name] of Object.entries(holidays)) {
        if (dateStr.substring(0, 4) === String(state.selectedYear) && dateStr.substring(4, 6) === monthStr) {
            const day = parseInt(dateStr.substring(6, 8));
            const dayOfWeekStr = ['일', '월', '화', '수', '목', '금', '토'][new Date(state.selectedYear, state.selectedMonth - 1, day).getDay()];
            monthHolidays.push({ day, name, dayOfWeekStr });
        }
    }

    // Sort chronologically
    monthHolidays.sort((a, b) => a.day - b.day);

    if (monthHolidays.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'holiday-list-empty';
        emptyDiv.textContent = '이달에는 지정 공휴일이 없습니다.';
        el.monthlyHolidayList.appendChild(emptyDiv);
        return;
    }

    for (const h of monthHolidays) {
        const li = document.createElement('li');
        li.className = 'holiday-list-li';

        const dateSpan = document.createElement('span');
        dateSpan.className = 'h-date';
        dateSpan.textContent = `${state.selectedMonth}월 ${h.day}일 (${h.dayOfWeekStr})`;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'h-name';
        nameSpan.textContent = h.name;

        li.appendChild(dateSpan);
        li.appendChild(nameSpan);

        // Add click listener to select this day in the calendar
        li.addEventListener('click', () => {
            selectDay(h.day);
        });

        el.monthlyHolidayList.appendChild(li);
    }
}

// Start
window.addEventListener('DOMContentLoaded', init);
