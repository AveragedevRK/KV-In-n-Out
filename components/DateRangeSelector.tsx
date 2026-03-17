import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Clock, CalendarRange } from 'lucide-react';

export type DateRangePreset = 'single' | 'last3' | 'last7' | 'last30' | 'mtd' | 'ytd' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  availableDates: string[];
  onCreateToday: () => void;
  hasTodayReport: boolean;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

const getPresetRange = (preset: DateRangePreset): { startDate: string; endDate: string } => {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  let startDate: string;

  switch (preset) {
    case 'last3': {
      const d = new Date(today);
      d.setDate(d.getDate() - 2);
      startDate = d.toISOString().split('T')[0];
      break;
    }
    case 'last7': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      startDate = d.toISOString().split('T')[0];
      break;
    }
    case 'last30': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      startDate = d.toISOString().split('T')[0];
      break;
    }
    case 'mtd': {
      startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    }
    case 'ytd': {
      startDate = `${today.getFullYear()}-01-01`;
      break;
    }
    default:
      startDate = endDate;
  }

  return { startDate, endDate };
};

const PRESETS: { key: DateRangePreset; label: string; icon: typeof Clock }[] = [
  { key: 'single', label: 'Single Day', icon: Calendar },
  { key: 'last3', label: 'Last 3 Days', icon: Clock },
  { key: 'last7', label: 'Last 7 Days', icon: Clock },
  { key: 'last30', label: 'Last 30 Days', icon: Clock },
  { key: 'mtd', label: 'Month to Date', icon: CalendarRange },
  { key: 'ytd', label: 'Year to Date', icon: CalendarRange },
  { key: 'custom', label: 'Custom Range', icon: CalendarRange },
];

const formatDateShort = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00');
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};

const formatDateDisplay = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00');
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
};

export { getPresetRange };

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateRange,
  onDateRangeChange,
  availableDates,
  onCreateToday,
  hasTodayReport,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<'presets' | 'single-dates' | 'custom'>('presets');
  const [customStart, setCustomStart] = useState(dateRange.startDate);
  const [customEnd, setCustomEnd] = useState(dateRange.endDate);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomStart(dateRange.startDate);
    setCustomEnd(dateRange.endDate);
  }, [dateRange]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveView('presets');
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const getDisplayLabel = () => {
    if (dateRange.preset === 'single') {
      return formatDateDisplay(dateRange.startDate);
    }
    const preset = PRESETS.find(p => p.key === dateRange.preset);
    if (dateRange.preset === 'custom') {
      return `${formatDateShort(dateRange.startDate)} - ${formatDateShort(dateRange.endDate)}`;
    }
    if (preset) {
      return preset.label;
    }
    return `${formatDateShort(dateRange.startDate)} - ${formatDateShort(dateRange.endDate)}`;
  };

  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'single') {
      setActiveView('single-dates');
      return;
    }
    if (preset === 'custom') {
      setActiveView('custom');
      return;
    }
    const range = getPresetRange(preset);
    onDateRangeChange({ preset, ...range });
    setIsOpen(false);
    setActiveView('presets');
  };

  const handleSingleDateClick = (date: string) => {
    onDateRangeChange({ preset: 'single', startDate: date, endDate: date });
    setIsOpen(false);
    setActiveView('presets');
  };

  const handleCustomApply = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      onDateRangeChange({ preset: 'custom', startDate: customStart, endDate: customEnd });
      setIsOpen(false);
      setActiveView('presets');
    }
  };

  const isRange = dateRange.preset !== 'single';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => { 
          setIsOpen(!isOpen); 
          // If already in single mode, go straight to the date list
          setActiveView(dateRange.preset === 'single' ? 'single-dates' : 'presets'); 
        }}
        className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-full border transition-all backdrop-blur-md ${
          isRange
            ? 'bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/15'
            : 'bg-white/5 border-white/10 hover:bg-white/10'
        }`}
      >
        {isRange ? (
          <CalendarRange size={14} className="text-cyan-400 md:w-4 md:h-4" />
        ) : (
          <Calendar size={14} className="text-zinc-400 md:w-4 md:h-4" />
        )}
        <span className={`text-xs md:text-sm font-medium ${isRange ? 'text-cyan-200' : 'text-zinc-200'}`}>
          {getDisplayLabel()}
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform md:w-3.5 md:h-3.5 ${isRange ? 'text-cyan-400' : 'text-zinc-500'} ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden">
          {/* Presets View */}
          {activeView === 'presets' && (
            <div className="py-2">
              <div className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Date Range
              </div>
              {PRESETS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handlePresetClick(key)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                    dateRange.preset === key
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} className="shrink-0 opacity-60" />
                  <span>{label}</span>
                  {dateRange.preset === key && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Single Date Picker View */}
          {activeView === 'single-dates' && (
            <div className="py-2">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Select Date
                </span>
                <button
                  onClick={() => setActiveView('presets')}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                >
                  Date Range
                </button>
              </div>
              {availableDates.length === 0 && (
                <div className="px-4 py-3 text-xs text-zinc-500">No reports found.</div>
              )}
              <div className="max-h-56 overflow-y-auto custom-scrollbar">
                {availableDates.map(date => (
                  <button
                    key={date}
                    onClick={() => handleSingleDateClick(date)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                      dateRange.preset === 'single' && dateRange.startDate === date
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <span>{formatDateDisplay(date)}</span>
                    {dateRange.preset === 'single' && dateRange.startDate === date && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
              {!hasTodayReport && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setActiveView('presets');
                    onCreateToday();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 border-t border-white/5 mt-1"
                >
                  + Create for Today
                </button>
              )}
            </div>
          )}

          {/* Custom Range View */}
          {activeView === 'custom' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveView('presets')}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {'<-'} Back
                </button>
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Custom Range
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-sm text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-white/5 focus:ring-1 focus:ring-white/10 transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-sm text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-white/5 focus:ring-1 focus:ring-white/10 transition-all font-mono"
                  />
                </div>
              </div>

              {customStart && customEnd && customStart > customEnd && (
                <p className="text-[10px] text-rose-400">Start date must be before end date</p>
              )}

              <button
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd || customStart > customEnd}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-white text-black hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Apply Range
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
