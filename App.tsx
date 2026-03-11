import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  DollarSign,
  TrendingUp,
  Wallet,
  CreditCard,
  Archive,
  Truck,
  PieChart,
  Activity,
  Calendar,
  CalendarRange,
  Plus,
  Copy,
  Check,
  Building2
} from 'lucide-react';
import { MetricCard, SubItem } from './components/MetricCard';
import { Orb } from './components/Orb';
import { AddReportModal } from './components/AddReportModal';
import { DateRangeSelector, DateRange } from './components/DateRangeSelector';
import { FinancialData, ShippingBreakdown, PayoutBreakdown } from './types';
import { db } from './firebase';
import { collection, doc, setDoc, getDocs, getDoc, serverTimestamp } from 'firebase/firestore';
import html2canvas from 'html2canvas';

// Noise SVG data URI for grain effect
const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E`;

const Operator: React.FC<{ symbol: string; className?: string }> = ({ symbol, className = "" }) => (
  <div className={`flex items-center justify-center shrink-0 text-white/30 text-2xl md:text-4xl font-thin select-none drop-shadow-[0_0_5px_rgba(255,255,255,0.1)] ${className}`}>
    {symbol}
  </div>
);

// Helper to get today's date string YYYY-MM-DD
const getTodayString = () => new Date().toISOString().split('T')[0];

const App: React.FC = () => {
  // Store reports indexed by date string (YYYY-MM-DD)
  const [reports, setReports] = useState<Record<string, FinancialData>>({});
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'single',
    startDate: getTodayString(),
    endDate: getTodayString(),
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const isRangeMode = dateRange.preset !== 'single';

  // Fetch all data from Firebase on mount to populate history
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "dailyReports"));
        const fetchedReports: Record<string, FinancialData> = {};
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedReports[doc.id] = {
            date: data.date,
            sales: data.sales,
            sellingFee: data.sellingFee,
            cogs: data.cogs,
            shipping: data.shipping,
            dailyInvestment: data.dailyInvestment,
            expectedDailyEarning: data.expectedDailyEarning,
            expectedWeeklyPayout: data.expectedWeeklyPayout,
            previousWeeksPayout: data.previousWeeksPayout,
            shippingBreakdown: data.shippingBreakdown,
            payoutBreakdown: data.payoutBreakdown
          } as FinancialData;
        });

        const dateKeys = Object.keys(fetchedReports);
        if (dateKeys.length > 0) {
          setReports(prev => ({ ...prev, ...fetchedReports }));
          
          // Sort dates descending to find the latest saved report
          const sortedDates = dateKeys.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
          // Default to the most recent report available
          setDateRange({ preset: 'single', startDate: sortedDates[0], endDate: sortedDates[0] });
        }
      } catch (error) {
        console.error("Error fetching history: ", error);
      }
    };

    fetchAllData();
  }, []);

  // Fetch specific document when in single-date mode and the date changes
  useEffect(() => {
    if (isRangeMode) return;
    const selectedDate = dateRange.startDate;
    
    const fetchSelectedReport = async () => {
      if (!selectedDate) return;

      try {
        const docRef = doc(db, "dailyReports", selectedDate);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedData = {
            date: data.date,
            sales: data.sales,
            sellingFee: data.sellingFee,
            cogs: data.cogs,
            shipping: data.shipping,
            dailyInvestment: data.dailyInvestment,
            expectedDailyEarning: data.expectedDailyEarning,
            expectedWeeklyPayout: data.expectedWeeklyPayout,
            previousWeeksPayout: data.previousWeeksPayout,
            shippingBreakdown: data.shippingBreakdown,
            payoutBreakdown: data.payoutBreakdown
          } as FinancialData;

          setReports(prev => ({
            ...prev,
            [selectedDate]: loadedData
          }));
        }
      } catch (error) {
        console.error("Error loading report:", error);
      }
    };

    fetchSelectedReport();
  }, [dateRange.startDate, isRangeMode]);

  const availableDates = useMemo(() => {
    return Object.keys(reports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [reports]);

  // Get reports within the selected date range
  const rangeReports = useMemo(() => {
    if (!isRangeMode) return [];
    return Object.values(reports).filter(r => r.date >= dateRange.startDate && r.date <= dateRange.endDate);
  }, [reports, dateRange, isRangeMode]);

  // Aggregated data for range mode
  const aggregatedData = useMemo((): FinancialData => {
    if (rangeReports.length === 0) {
      return {
        date: dateRange.startDate,
        sales: 0, sellingFee: 0, cogs: 0, shipping: 0,
        dailyInvestment: 0, expectedDailyEarning: 0,
        expectedWeeklyPayout: 0, previousWeeksPayout: 0,
        shippingBreakdown: { cards: [], balance: 0 },
        payoutBreakdown: { accounts: [], total: 0 },
      };
    }
    return {
      date: dateRange.startDate,
      sales: rangeReports.reduce((s, r) => s + r.sales, 0),
      sellingFee: rangeReports.reduce((s, r) => s + r.sellingFee, 0),
      cogs: rangeReports.reduce((s, r) => s + r.cogs, 0),
      shipping: rangeReports.reduce((s, r) => s + r.shipping, 0),
      dailyInvestment: rangeReports.reduce((s, r) => s + r.dailyInvestment, 0),
      expectedDailyEarning: rangeReports.reduce((s, r) => s + r.expectedDailyEarning, 0),
      expectedWeeklyPayout: rangeReports.reduce((s, r) => s + r.expectedWeeklyPayout, 0),
      previousWeeksPayout: rangeReports.reduce((s, r) => s + r.previousWeeksPayout, 0),
      shippingBreakdown: { cards: [], balance: 0 },
      payoutBreakdown: { accounts: [], total: 0 },
    };
  }, [rangeReports, dateRange.startDate]);

  // Single-day data fallback
  const singleData = useMemo(() => {
    const selectedDate = dateRange.startDate;
    return reports[selectedDate] || {
      date: selectedDate,
      sales: 0, sellingFee: 0, cogs: 0, shipping: 0,
      dailyInvestment: 0, expectedDailyEarning: 0,
      expectedWeeklyPayout: 0, previousWeeksPayout: 0,
      shippingBreakdown: { cards: [], balance: 0 },
      payoutBreakdown: { accounts: [], total: 0 }
    };
  }, [reports, dateRange.startDate]);

  const currentData = isRangeMode ? aggregatedData : singleData;

  const profit = currentData.sales - (currentData.sellingFee + currentData.cogs + currentData.shipping);
  const totalDailyExpenditure = currentData.dailyInvestment + currentData.shipping;

  const reportRef = useRef<HTMLDivElement>(null);

  const handleSaveReport = async (newData: FinancialData) => {
    // Optimistic update
    setReports(prev => ({
      ...prev,
      [newData.date]: newData
    }));
    setDateRange({ preset: 'single', startDate: newData.date, endDate: newData.date });

    try {
      await setDoc(doc(db, "dailyReports", newData.date), {
        ...newData,
        createdAt: serverTimestamp()
      });
      console.log("Saved successfully");
    } catch (error) {
      console.error("Error saving document: ", error);
      alert("Failed to save report. Please check your connection.");
      // Re-throw so modal knows it failed
      throw error;
    }
  };
  
  const handleCopyReport = async () => {
    if (!reportRef.current || isCopying) return;
    
    setIsCopying(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#09090b',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          const element = clonedDoc.querySelector('[data-report-container]') as HTMLElement;
          if (element) {
            element.style.padding = "20px";
            element.style.borderRadius = "24px";
            // Ensure container width is fixed for screenshot to prevent mobile stacking layout in the image if desired, 
            // or let it be responsive. Letting it be responsive matches what the user sees.
          }
        }
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
            console.error("Canvas to blob failed");
            return;
        }
        
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
          console.error("Clipboard write failed", err);
          alert("Could not copy image to clipboard. Browser may not support it.");
        }
      }, 'image/png');
    } catch (err) {
      console.error("Screenshot failed", err);
      alert("Failed to generate screenshot.");
    } finally {
      setIsCopying(false);
    }
  };

  const getShippingBreakdown = (breakdown: ShippingBreakdown): SubItem[] => {
    const cardItems = breakdown?.cards?.map(card => ({
      icon: CreditCard,
      label: `Card •• ${card.last4}`,
      amount: card.amount
    })) || [];

    if (breakdown?.balance) {
      cardItems.push({ icon: Wallet, label: 'Seller Balance', amount: breakdown.balance });
    }

    return cardItems;
  };

  const getPayoutBreakdown = (breakdown?: PayoutBreakdown): SubItem[] => {
      if (!breakdown || !breakdown.accounts) return [];
      
      return breakdown.accounts.map(acc => ({
          icon: Building2,
          label: acc.name || 'Account',
          amount: acc.amount
      }));
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  };

  return (
    <div className="relative min-h-[100dvh] w-full bg-black text-zinc-100 font-sans selection:bg-cyan-500/30">
      
      {/* 
         FIX: Background Elements Container - FIXED position
         This ensures the background covers the viewport but doesn't affect document flow.
      */}
      <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        {/* Noise Texture Overlay */}
        <div 
          className="absolute inset-0 mix-blend-overlay opacity-30"
          style={{ backgroundImage: `url("${NOISE_SVG}")` }}
        ></div>

        {/* Background Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(20,20,30,1),_rgba(0,0,0,1))]"></div>
        
        {/* Decorative Orbs */}
        <Orb hue={280} size={900} speed={0.004} className="top-[-30%] left-[-20%] md:top-[-40%] md:left-[-20%] animate-pulse-slow" />
        <Orb hue={180} size={800} speed={0.006} className="bottom-[-30%] right-[-20%] md:bottom-[-40%] md:right-[-20%]" />
        <Orb hue={320} size={400} speed={0.008} className="top-[20%] right-[10%] opacity-40" />
      </div>

      {/* Content Scroll Wrapper */}
      <div className="relative z-10 w-full flex flex-col items-center justify-start p-4 md:p-8 pb-20">
        {/* Responsive Header */}
        <header className="w-full max-w-[1600px] mx-auto z-50 flex flex-col md:flex-row justify-between items-center gap-4 mb-6 md:mb-12 pt-2 md:pt-0">
          
          {/* Logo */}
          <div className="flex-shrink-0">
            <img 
              src="https://app.kambojventures.com/assets/images/logos/logo.png" 
              alt="Kamboj Ventures" 
              className="h-10 md:h-12 w-auto drop-shadow-lg opacity-90 hover:opacity-100 transition-opacity"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center md:justify-end w-full md:w-auto">
            
            {/* Copy Button */}
            <button
              onClick={handleCopyReport}
              disabled={isCopying}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-full border transition-all duration-300 backdrop-blur-md ${
                copySuccess 
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white'
              }`}
            >
              {copySuccess ? <Check size={14} className="md:w-4 md:h-4" /> : <Copy size={14} className="md:w-4 md:h-4" />}
              <span className="text-xs md:text-sm font-medium">
                {isCopying ? 'Copying...' : copySuccess ? 'Copied' : 'Copy'}
              </span>
            </button>

            {/* Date Range Selector */}
            <DateRangeSelector
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              availableDates={availableDates}
              hasTodayReport={!!reports[getTodayString()]}
              onCreateToday={() => {
                setDateRange({ preset: 'single', startDate: getTodayString(), endDate: getTodayString() });
                setIsModalOpen(true);
              }}
            />

            {/* Add Report Button */}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="group flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:scale-105 transition-all duration-300 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.1)]"
            >
              <span className="p-0.5 md:p-1 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                <Plus size={14} className="text-emerald-400 md:w-4 md:h-4" />
              </span>
              <span className="text-xs md:text-sm font-medium text-emerald-100 pr-1">Add Report</span>
            </button>
          </div>
        </header>

        {/* Main Report Container */}
        <div 
          ref={reportRef}
          data-report-container="true"
          className="relative z-10 w-full max-w-[1600px] mx-auto space-y-4 md:space-y-8"
        >
          
          {/* TOP SECTION: P&L Calculator */}
          {/* Mobile: Vertical Stack / Desktop: Horizontal Row */}
          <div className="group relative rounded-2xl md:rounded-3xl border border-white/5 bg-white/5 p-4 md:p-10 shadow-2xl backdrop-blur-2xl transition-all hover:bg-white/[0.07]">
            
            {/* Glossy sheen */}
            <div className="absolute inset-0 rounded-2xl md:rounded-3xl bg-gradient-to-tr from-white/5 via-transparent to-transparent pointer-events-none"></div>

            {/* Header */}
            <div className="mb-4 md:mb-8 border-b border-white/10 pb-3 md:pb-4 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-0">
              <h1 className="text-lg md:text-2xl font-light text-white tracking-tight flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md shadow-inner">
                    <Activity size={16} className="text-zinc-300 md:w-5 md:h-5" />
                  </div>
                  Operations P&L
              </h1>
              <div className={`self-start md:self-auto text-[10px] md:text-xs font-mono border rounded-full px-2 md:px-3 py-1 bg-black/20 flex items-center gap-1.5 md:gap-2 ${isRangeMode ? 'text-cyan-400 border-cyan-500/20' : 'text-zinc-500 border-white/5'}`}>
                {isRangeMode ? <CalendarRange size={10} className="md:w-3 md:h-3" /> : <Calendar size={10} className="md:w-3 md:h-3" />}
                {isRangeMode 
                  ? `${formatDateDisplay(dateRange.startDate)} - ${formatDateDisplay(dateRange.endDate)} (${rangeReports.length} ${rangeReports.length === 1 ? 'report' : 'reports'})`
                  : formatDateDisplay(currentData.date)
                }
              </div>
            </div>

            {/* P&L Flow */}
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-2 md:gap-3">
              
              <div className="flex-1">
                <MetricCard 
                  label="Gross Sales" 
                  amount={currentData.sales} 
                  icon={Wallet}
                  iconColor="text-zinc-300"
                  accentColor="bg-zinc-200" 
                />
              </div>

              <Operator symbol="-" className="hidden md:flex" />

              <div className="flex-1">
                <MetricCard 
                  label="Fees" 
                  amount={currentData.sellingFee} 
                  icon={CreditCard}
                  iconColor="text-zinc-400"
                  accentColor="bg-zinc-500"
                />
              </div>
              
              {/* Mobile Operator */}
              <div className="flex md:hidden justify-center -my-1 relative z-0 opacity-50"><Operator symbol="-" className="text-lg" /></div>

              <Operator symbol="-" className="hidden md:flex" />

              <div className="flex-1">
                <MetricCard 
                  label="COGS" 
                  amount={currentData.cogs} 
                  icon={Archive}
                  iconColor="text-zinc-400"
                  accentColor="bg-zinc-500"
                />
              </div>

              <div className="flex md:hidden justify-center -my-1 relative z-0 opacity-50"><Operator symbol="-" className="text-lg" /></div>

              <Operator symbol="-" className="hidden md:flex" />

              <div className="flex-1">
                <MetricCard 
                  label="Shipping" 
                  amount={currentData.shipping} 
                  icon={Truck}
                  iconColor="text-zinc-400"
                  accentColor="bg-zinc-500"
                  subItems={!isRangeMode ? getShippingBreakdown(currentData.shippingBreakdown) : undefined}
                />
              </div>

              <div className="flex md:hidden justify-center -my-1 relative z-0 opacity-50"><Operator symbol="=" className="text-lg" /></div>

              <Operator symbol="=" className="hidden md:flex" />
              
              <div className="flex-1 transform transition-transform hover:scale-[1.02] md:hover:scale-105">
                <MetricCard 
                  label={isRangeMode ? "Total Net Profit" : "Net Profit"}
                  amount={profit} 
                  icon={TrendingUp}
                  iconColor={profit >= 0 ? "text-emerald-300" : "text-rose-300"}
                  accentColor={profit >= 0 ? "bg-emerald-400" : "bg-rose-400"}
                  textColor={profit >= 0 ? "text-emerald-200 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]" : "text-rose-200 drop-shadow-[0_0_10px_rgba(251,113,133,0.3)]"}
                />
              </div>

            </div>
          </div>

          {/* BOTTOM SECTION: Split View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            
            {/* Daily Expenditure Panel */}
            <div className="relative rounded-2xl md:rounded-3xl border border-white/5 bg-white/5 p-4 md:p-8 flex flex-col h-full backdrop-blur-2xl shadow-xl transition-all hover:bg-white/[0.07]">
              <div className="absolute inset-0 rounded-2xl md:rounded-3xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
              
              <div className="relative z-10 flex items-center gap-2 md:gap-3 mb-4 md:mb-6 pb-3 md:pb-4 border-b border-white/10">
                <div className="p-1.5 md:p-2 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                  <PieChart size={16} className="md:w-5 md:h-5" />
                </div>
                <h2 className="text-lg md:text-xl font-light text-zinc-100">{isRangeMode ? 'Total Expenditure' : 'Daily Expenditure'}</h2>
              </div>
              
              <div className="relative z-10 space-y-3 md:space-y-4 flex-1">
                <MetricCard 
                  label={isRangeMode ? "Total Investment" : "Investment"}
                  amount={currentData.dailyInvestment} 
                  icon={Wallet}
                  iconColor="text-rose-300/80"
                  accentColor="bg-rose-500" 
                />
                <MetricCard 
                  label={isRangeMode ? "Total Shipping" : "Shipping"}
                  amount={currentData.shipping} 
                  icon={Truck}
                  iconColor="text-rose-300/80"
                  accentColor="bg-rose-500" 
                  subItems={!isRangeMode ? getShippingBreakdown(currentData.shippingBreakdown) : undefined}
                />
              </div>
              <div className="relative z-10 mt-4 md:mt-6 pt-3 md:pt-4 border-t border-white/10 flex justify-between items-center text-rose-200/80">
                  <span className="text-[10px] md:text-xs font-mono uppercase tracking-wider">Total Outflow</span>
                  <span className="text-lg md:text-xl font-light tabular-nums drop-shadow-lg">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalDailyExpenditure)}
                  </span>
              </div>
            </div>

            {/* Daily Earning Panel */}
            <div className="relative rounded-2xl md:rounded-3xl border border-white/5 bg-white/5 p-4 md:p-8 flex flex-col h-full backdrop-blur-2xl shadow-xl transition-all hover:bg-white/[0.07]">
              <div className="absolute inset-0 rounded-2xl md:rounded-3xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

              <div className="relative z-10 flex items-center gap-2 md:gap-3 mb-4 md:mb-6 pb-3 md:pb-4 border-b border-white/10">
                <div className="p-1.5 md:p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <Calendar size={16} className="md:w-5 md:h-5" />
                </div>
                <h2 className="text-lg md:text-xl font-light text-zinc-100">{isRangeMode ? 'Total Earnings' : 'Daily Earning'}</h2>
              </div>
              
              <div className="relative z-10 space-y-3 md:space-y-4 flex-1">
                <MetricCard 
                  label={isRangeMode ? "Total Daily Earnings" : "Expected Daily Earning"}
                  amount={currentData.expectedDailyEarning} 
                  icon={TrendingUp}
                  iconColor="text-emerald-300/80"
                  accentColor="bg-emerald-500" 
                />
                <MetricCard 
                  label={isRangeMode ? "Total Weekly Payouts" : "Expected Weekly Payout"}
                  amount={currentData.expectedWeeklyPayout} 
                  icon={DollarSign}
                  iconColor="text-emerald-300/80"
                  accentColor="bg-emerald-500" 
                  subItems={!isRangeMode ? getPayoutBreakdown(currentData.payoutBreakdown) : undefined}
                />
              </div>
              <div className="relative z-10 mt-4 md:mt-6 pt-3 md:pt-4 border-t border-white/10 flex justify-between items-center text-emerald-200/80">
                  <span className="text-[10px] md:text-xs font-mono uppercase tracking-wider">Previous Week's Payout</span>
                  <span className="text-lg md:text-xl font-light tabular-nums drop-shadow-lg">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(currentData.previousWeeksPayout)}
                  </span>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="flex justify-between items-center px-4 py-6 border-t border-white/5">
            <div></div>
            <div className="flex gap-2 opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
            </div>
          </div>

        </div>

      </div>

      <AddReportModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveReport}
        initialData={singleData}
      />
    </div>
  );
};

export default App;
