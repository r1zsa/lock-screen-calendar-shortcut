// Year Progress Wallpaper v26 - Configurable Version
// by agaragou
// https://github.com/agaragou/LockScreen-Calendar-ShortCut
const CONFIG = {
    // --- USER CONFIGURATION ---

    // How many months to show? (e.g. 12 = Year, 3 = Quarter, 1 = Month)
    monthsToShow: 12,
    // How many columns per row? (Standard is 3)
    monthsPerRow: 3,

    // --- LAYOUT w/ WIDGETS ---
    // If true, the script will push content down/up to avoid widget areas.
    widgetsTop: false,
    topWidgetsPadding: 0.37, // How much space to skip at the top (0.37 = 37% of screen height)

    widgetsBottom: false,
    bottomWidgetsPadding: 0.14, // How much space to reserve at the bottom (0.14 = 14% of screen height)

    // Calendar Key (only calendars starting with this character will be shown)
    calendarPrefix: "*",
    // Optional: List of specific calendar names to USE (overrides prefix)
    // specificCalendarNames: ["Work", "Home"], 
    specificCalendarNames: [],

    // Start of week: 0 = Sunday, 1 = Monday
    firstDayOfWeek: 1,

    // Show yearly statistics text at the bottom?
    showStats: true,

    // Show day numbers instead of dots
    // true = draws "1", "2", "3"...
    // false = draws dots (default)
    showDayNumbers: true,

    // Manual significant dates (if you don't want to use a calendar)
    // Format: "MM-DD"
    manualSignificantDates: [], // Example: ["01-01", "12-31"]

    // Sort priority: Which event is drawn on top if they overlap?
    // true = Alphabetical (e.g. "1.Holiday" covers "2.Work")
    // false = Random (depends on system order)
    sortByName: true,

    // Interface Colors
    colors: {
        bg: new Color("#000000"),
        pastDay: new Color("#aaaaaa", 0.95),
        futureDay: new Color("#2c2c2e"),
        today: new Color("#ff3b30"),
        significant: new Color("#FFD60A"), // For manualSignificantDates
        text: new Color("#98989d"),
        stats: new Color("#ff9f0a")
    },

    // Design Ratios (Auto-Scale)
    ratios: {
        topPadding: 0.335, // Default start without top widgets
        spacing: 30.5,
        radius: 0.3,
        monthGap: 2.1,
        colGap: 1.6
    }
};

// --- 1. AUTO-DETECT SCREEN SIZE ---
const screen = Device.screenSize();
const width = screen.width;
const height = screen.height;

// --- LAYOUT CALCULATIONS ---
// 1. Determine safe drawing area vertical range
let startY = height * CONFIG.ratios.topPadding;
if (CONFIG.widgetsTop) {
    startY = height * CONFIG.topWidgetsPadding;
}

let endY = height;
if (CONFIG.widgetsBottom) {
    endY = height * (1 - CONFIG.bottomWidgetsPadding);
}

const availableHeight = endY - startY;

// 2. Initial sizing based on WIDTH (standard logic)
let dotSpacing = width / CONFIG.ratios.spacing;
let dotRadius = dotSpacing * CONFIG.ratios.radius;
let monthGap = dotSpacing * CONFIG.ratios.monthGap;
let colGap = dotSpacing * CONFIG.ratios.colGap;
let fontSizeMonth = width * 0.022;
let fontSizeStats = width * 0.028;
let fontSizeDay = width * 0.022; // Size for day numbers

// 3. Check if we need to SCALE DOWN to fit Height
const rows = Math.ceil(CONFIG.monthsToShow / CONFIG.monthsPerRow);
const singleRowHeightInitial = (6 * dotSpacing) + (fontSizeMonth * 2) + monthGap;
const statsHeight = CONFIG.showStats ? (fontSizeStats * 4) : 0;
const totalContentHeight = (rows * singleRowHeightInitial) + statsHeight;

if (totalContentHeight > availableHeight) {
    // Calculate scaling factor
    // Equation: availableHeight = rows * (6*S + const1*S + const2*S) ... roughly linear
    // Simple scaling: scale = available / required
    const scale = availableHeight / totalContentHeight;

    // Apply scale to all dimension variables
    dotSpacing *= scale;
    dotRadius *= scale;
    monthGap *= scale;
    colGap *= scale;
    fontSizeMonth *= scale;
    fontSizeStats *= scale;
    fontSizeDay *= scale;
}

const PADDING_TOP = startY;
const DOT_SPACING = dotSpacing;
const DOT_RADIUS = dotRadius;
const MONTH_GAP = monthGap;
const COL_GAP = colGap;
const SINGLE_ROW_HEIGHT = (6 * DOT_SPACING) + (fontSizeMonth * 2) + MONTH_GAP; // Re-calculate with potentially scaled values

// --- 2. AUTO-SCAN CALENDARS ---
const date = new Date();
const currentYear = date.getFullYear();
const currentMonth = date.getMonth();
const currentDay = date.getDate();

async function fetchAutoCalendars() {
    let calendarsList = [];

    // Calculate range based on monthsToShow
    // We need to cover enough future time
    const futureYears = Math.ceil(CONFIG.monthsToShow / 12);
    const startOfRange = new Date(currentYear, 0, 1);
    const endOfRange = new Date(currentYear + futureYears, 11, 31, 23, 59, 59);

    try {
        const allCalendars = await Calendar.forEvents();

        let targetCalendars;
        if (CONFIG.specificCalendarNames && CONFIG.specificCalendarNames.length > 0) {
            targetCalendars = allCalendars.filter(c => CONFIG.specificCalendarNames.includes(c.title));
        } else {
            targetCalendars = allCalendars.filter(c => c.title.startsWith(CONFIG.calendarPrefix));
        }

        // Sort by name for priority control
        if (CONFIG.sortByName) {
            targetCalendars.sort((a, b) => a.title.localeCompare(b.title));
        }

        for (let cal of targetCalendars) {
            const events = await CalendarEvent.between(startOfRange, endOfRange, [cal]);

            calendarsList.push({
                name: cal.title,
                color: cal.color, // GET COLOR DIRECTLY FROM IOS
                events: events.map(e => ({
                    start: e.startDate,
                    end: e.endDate
                }))
            });
        }
    } catch (e) { console.log("Error: " + e.message); }

    return calendarsList;
}

const activeCalendarsData = await fetchAutoCalendars();

// --- 3. DRAWING ---
const ctx = new DrawContext();
ctx.size = new Size(width, height);
ctx.respectScreenScale = true;
ctx.opaque = true;
ctx.setFillColor(CONFIG.colors.bg);
ctx.fillRect(new Rect(0, 0, width, height));

// const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getDayColor(year, month, day) {
    const monthStr = (month + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const dateString = `${monthStr}-${dayStr}`;

    // Calculate absolute day values for comparison (year * 10000 + month * 100 + day)
    const absCurrent = currentYear * 10000 + currentMonth * 100 + currentDay;
    const absTarget = year * 10000 + month * 100 + day;

    const isPast = absTarget < absCurrent;
    const isToday = absTarget === absCurrent;

    // 1. Priority: Today
    if (isToday) return CONFIG.colors.today;

    // 2. Priority: Manual Dates
    if (CONFIG.manualSignificantDates.includes(dateString)) return CONFIG.colors.significant;

    const dayStart = new Date(year, month, day, 0, 0, 0);
    const dayEnd = new Date(year, month, day, 23, 59, 59);

    // 3. Priority: Calendars
    for (let calData of activeCalendarsData) {
        for (let event of calData.events) {
            if (event.start <= dayEnd && event.end >= dayStart) {
                return calData.color;
            }
        }
    }

    // 4. Background
    if (isPast) return CONFIG.colors.pastDay;
    return CONFIG.colors.futureDay;
}

const monthBlockWidth = (6 * DOT_SPACING) + (DOT_RADIUS * 2);
const totalCalendarWidth = (CONFIG.monthsPerRow * monthBlockWidth) + ((CONFIG.monthsPerRow - 1) * COL_GAP);
const startX = (width - totalCalendarWidth) / 2;

// Loop for dynamic number of months
const START_MONTH_OFFSET = -1; // 0 means start from Current Month. Change to -1 for Previous, etc.

for (let i = START_MONTH_OFFSET; i < START_MONTH_OFFSET + CONFIG.monthsToShow; i++) {
    // Logic to handle month/year overflow
    let targetMonthIndex = (currentMonth + i);

    // Correction for negative indices (if we supported past months properly in the loop)
    // Standard math for modulo with negatives
    targetMonthIndex = ((targetMonthIndex % 12) + 12) % 12;

    let targetYear = currentYear + Math.floor((currentMonth + i) / 12);

    // Adjust i for grid placement if we started with negative offset
    let gridIndex = i - START_MONTH_OFFSET;
    const colIndex = gridIndex % CONFIG.monthsPerRow;
    const rowIndex = Math.floor(gridIndex / CONFIG.monthsPerRow);

    const blockX = startX + (colIndex * (monthBlockWidth + COL_GAP));
    const rowHeight = SINGLE_ROW_HEIGHT;
    const blockY = PADDING_TOP + (rowIndex * rowHeight);

    ctx.setTextColor(CONFIG.colors.text);
    ctx.setFont(Font.boldSystemFont(fontSizeMonth));
    ctx.setTextAlignedLeft();

    // Header Text
    let headerText = monthNames[targetMonthIndex];
    // Add year if it's different from start or if it's Jan
    if (targetYear !== currentYear || (targetMonthIndex === 0 && i !== 0)) {
        headerText += ` '${targetYear.toString().slice(-2)}`;
    }

    ctx.drawText(headerText, new Point(blockX - (DOT_SPACING * 0.1), blockY - (DOT_SPACING * 1.2)));

    const daysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    let firstDayWeek = new Date(targetYear, targetMonthIndex, 1).getDay();
    // Calculate empty slots at start of month
    // 0 = Sunday, 1 = Monday, etc.
    let startOffset = (firstDayWeek - CONFIG.firstDayOfWeek + 7) % 7;

    for (let d = 1; d <= daysInMonth; d++) {
        const dayIndex = (startOffset + d - 1);
        const gridX = dayIndex % 7;
        const gridY = Math.floor(dayIndex / 7);
        const dotX = blockX + (gridX * DOT_SPACING);
        const dotY = blockY + (gridY * DOT_SPACING);

        // Pass targetYear to getDayColor to handle year boundaries correctly
        const fillColor = getDayColor(targetYear, targetMonthIndex, d);
        if (CONFIG.showDayNumbers) {
            ctx.setTextColor(fillColor);
            ctx.setFont(Font.boldSystemFont(fontSizeDay * 0.9)); // Slightly smaller for numbers
            ctx.setTextAlignedCenter();
            // Center text in the grid cell
            // Used DOT_SPACING as width/height to center in the cell space
            const textRect = new Rect(dotX - (DOT_SPACING * 0.1), dotY - (DOT_SPACING * 0.15), DOT_SPACING * 1.2, DOT_SPACING);
            ctx.drawTextInRect(d.toString(), textRect);
        } else {
            ctx.setFillColor(fillColor);
            ctx.fillEllipse(new Rect(dotX, dotY, DOT_RADIUS * 2, DOT_RADIUS * 2));
        }
    }
}

// --- STATS ---
if (CONFIG.showStats) {
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear + 1, 0, 1);
    const totalDays = (endOfYear - startOfYear) / (1000 * 60 * 60 * 24);
    const daysPassed = Math.ceil(Math.abs(date - startOfYear) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.floor(totalDays - daysPassed);
    const percentPassed = Math.floor((daysPassed / totalDays) * 100);

    // Calculate dynamic stats position based on total rows
    const totalRows = Math.ceil(CONFIG.monthsToShow / CONFIG.monthsPerRow);

    // Position stats below all rows
    const statsY = PADDING_TOP + (totalRows * SINGLE_ROW_HEIGHT) + (MONTH_GAP * 0.5);
    const statsRect = new Rect(0, statsY, width, fontSizeStats * 3);

    ctx.setTextAlignedCenter();
    ctx.setFont(Font.boldSystemFont(fontSizeStats));
    ctx.setTextColor(CONFIG.colors.stats);
    ctx.drawTextInRect(`${daysLeft} days left  •  ${percentPassed}%`, statsRect);
}

// --- OUTPUT ---
const image = ctx.getImage();
const base64Str = Data.fromPNG(image).toBase64String();
Script.setShortcutOutput(base64Str);

Script.complete();
