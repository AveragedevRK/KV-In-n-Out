import React, { useState, useEffect } from 'react';
import { X, Save, Wallet, CreditCard, LayoutDashboard, Plus, Trash2, Calendar, AlertTriangle, Building2, Lock, CheckCircle2 } from 'lucide-react';
import { FinancialData, ShippingBreakdown, PayoutBreakdown } from '../types';
import { db } from '../firebase';
import { collection, addDoc, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';

interface AddReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FinancialData) => Promise<void>;
  initialData: FinancialData;
}

const LOCAL_STORAGE_KEY = 'kv_report_draft';

// Default accounts to seed if DB is empty
const DEFAULT_ACCOUNTS = [
  "Vegan Earth",
  "Chito's Toys",
  "Playing Gorilla",
  "Urban VII",
  "Aquarios",
  "Green Illusions"
];

export const AddReportModal: React.FC<AddReportModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [formData, setFormData] = useState<FinancialData>(initialData);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Account Management State
  const [availableAccounts, setAvailableAccounts] = useState<{id: string, name: string}[]>([]);
  const [showAccountCreator, setShowAccountCreator] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [accountError, setAccountError] = useState('');

  // Load persistence on open
  useEffect(() => {
    if (isOpen) {
      const savedDraft = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          // Ensure payoutBreakdown exists if loading from an old draft
          if (!parsed.payoutBreakdown) {
             parsed.payoutBreakdown = { accounts: [], total: parsed.expectedWeeklyPayout || 0 };
          }
          setFormData(parsed);
        } catch (e) {
          console.error("Failed to parse draft", e);
          setFormData(initialData);
        }
      } else {
        // Ensure payoutBreakdown exists for initial data
        const dataWithBreakdown = { ...initialData };
        if (!dataWithBreakdown.payoutBreakdown) {
            dataWithBreakdown.payoutBreakdown = { 
                accounts: [], 
                total: dataWithBreakdown.expectedWeeklyPayout || 0 
            };
        }
        setFormData(dataWithBreakdown);
      }
    }
  }, [isOpen, initialData]);

  // Fetch Accounts & Seed if empty
  useEffect(() => {
    if (!isOpen) return;

    const accountsRef = collection(db, 'payout_accounts');
    
    // Check and seed if necessary (one-time check on mount/open)
    const checkAndSeed = async () => {
        try {
            const snap = await getDocs(accountsRef);
            if (snap.empty) {
                console.log("Seeding default accounts...");
                await Promise.all(DEFAULT_ACCOUNTS.map(name => addDoc(accountsRef, { name })));
            }
        } catch (err) {
            console.error("Error seeding accounts:", err);
        }
    };
    checkAndSeed();

    // Subscribe to changes
    const q = query(accountsRef, orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const accounts = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name as string
        }));
        setAvailableAccounts(accounts);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Persist changes
  useEffect(() => {
    if (isOpen) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
    }
  }, [formData, isOpen]);

  // Auto-calculate Daily Earning whenever Date or Payout Total changes
  useEffect(() => {
    if (isOpen && formData.date && formData.payoutBreakdown) {
        const date = new Date(formData.date);
        let dayIndex = date.getDay(); // 0=Sun, 1=Mon...
        if (dayIndex === 0) dayIndex = 7; // Treat Sunday as 7th day
        
        // Logic: Wednesday (3) -> 2 days passed. Mon(1) -> 0 days passed (use 1 as min divisor).
        // Divisor = DayIndex - 1. 
        const daysPassed = Math.max(1, dayIndex - 1);
        
        const calculatedDaily = formData.payoutBreakdown.total / daysPassed;
        
        if (formData.expectedDailyEarning !== calculatedDaily) {
            setFormData(prev => ({
                ...prev,
                expectedDailyEarning: calculatedDaily
            }));
        }
    }
  }, [formData.date, formData.payoutBreakdown, isOpen]);

  const handleChange = (field: keyof FinancialData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'date' ? value : (parseFloat(value) || 0)
    }));
  };

  const handleShippingChange = (
    newBreakdown: ShippingBreakdown
  ) => {
    setFormData(prev => {
      // Calculate total for this specific breakdown
      const total = newBreakdown.cards.reduce((sum, c) => sum + c.amount, 0) + newBreakdown.balance;
      
      const updates: Partial<FinancialData> = { 
        shippingBreakdown: newBreakdown,
        shipping: total
      };

      return { ...prev, ...updates };
    });
  };

  const handlePayoutChange = (newBreakdown: PayoutBreakdown) => {
      setFormData(prev => ({
          ...prev,
          payoutBreakdown: newBreakdown,
          expectedWeeklyPayout: newBreakdown.total
      }));
  };

  const processSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      // Only remove if successful
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      onClose();
    } catch (e) {
      console.error("Save failed in modal", e);
      // Stay open if failed
    } finally {
      setIsSaving(false);
      setShowConfirm(false); // Close confirm modal if it was open
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check Date
    const today = new Date().toISOString().split('T')[0];
    if (formData.date !== today) {
      setShowConfirm(true);
      return;
    }

    processSave();
  };

  const handleCreateAccount = async () => {
    setAccountError('');
    if (!newAccountName.trim()) {
        setAccountError('Account name is required');
        return;
    }
    if (securityCode !== 'sudo') {
        setAccountError('Invalid security code');
        return;
    }
    
    // Check if exists
    if (availableAccounts.some(a => a.name.toLowerCase() === newAccountName.toLowerCase())) {
        setAccountError('Account already exists');
        return;
    }

    try {
        await addDoc(collection(db, 'payout_accounts'), { name: newAccountName.trim() });
        setShowAccountCreator(false);
        setNewAccountName('');
        setSecurityCode('');
    } catch (e) {
        console.error("Error creating account", e);
        setAccountError('Failed to create account');
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
        
        <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4 -mx-2 px-2">
          <h2 className="text-xl font-light text-white flex items-center gap-2">
            <LayoutDashboard className="text-emerald-400" size={20} />
            Edit Report Data
          </h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section: Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium ml-1">Report Date</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  <Calendar size={16} />
                </div>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-white/20 focus:bg-white/5 focus:ring-1 focus:ring-white/10 transition-all font-sans"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 1: Operations P&L */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              Operations P&L
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <InputGroup label="Gross Sales" value={formData.sales} onChange={(v) => handleChange('sales', v)} icon="$" />
              <InputGroup label="Platform Fees" value={formData.sellingFee} onChange={(v) => handleChange('sellingFee', v)} icon="-" />
              <InputGroup label="Cost of Goods (COGS)" value={formData.cogs} onChange={(v) => handleChange('cogs', v)} icon="-" />
            </div>
            
            {/* Shipping Breakdown */}
            <ShippingEditor 
              title="Shipping Costs" 
              data={formData.shippingBreakdown}
              total={formData.shipping}
              onChange={handleShippingChange}
            />
          </section>

          {/* Section 2: Daily Expenditure */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              Daily Expenditure
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
               <InputGroup label="Daily Investment" value={formData.dailyInvestment} onChange={(v) => handleChange('dailyInvestment', v)} icon="$" />
            </div>
          </section>

           {/* Section 3: Daily Earning */}
           <section>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Projections
            </h3>
            
            <div className="mb-6">
                <PayoutEditor 
                    data={formData.payoutBreakdown || { accounts: [], total: 0 }} 
                    onChange={handlePayoutChange}
                    availableAccounts={availableAccounts}
                    onCreateAccount={() => setShowAccountCreator(true)}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Daily Earning is now Read Only / Calculated */}
              <div className="space-y-1.5 opacity-80">
                <label className="text-xs text-emerald-400 font-medium ml-1">Daily Earning (Calculated)</label>
                <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none">
                    $
                    </div>
                    <input
                    type="number"
                    value={formData.expectedDailyEarning}
                    readOnly
                    className="w-full bg-emerald-900/10 border border-emerald-500/20 rounded-xl py-2.5 pl-9 pr-3 text-sm text-emerald-200 focus:outline-none font-mono cursor-not-allowed"
                    />
                </div>
              </div>

              <InputGroup label="Previous Week's Payout" value={formData.previousWeeksPayout} onChange={(v) => handleChange('previousWeeksPayout', v)} icon="$" />
            </div>
          </section>

          <div className="pt-6 border-t border-white/10 flex justify-end gap-3 sticky bottom-0 bg-zinc-900/95 py-4 z-20 -mx-2 px-2 backdrop-blur-xl">
             <button 
               type="button" 
               onClick={onClose}
               className="px-6 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
               disabled={isSaving}
             >
               Cancel
             </button>
             <button 
               type="submit"
               disabled={isSaving}
               className="px-6 py-2.5 rounded-xl text-sm font-medium bg-white text-black hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isSaving ? (
                 <span className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin"></span>
               ) : <Save size={16} />}
               {isSaving ? 'Saving...' : 'Save Changes'}
             </button>
          </div>

        </form>
      </div>
    </div>
    
    {/* Confirmation Overlay Modal */}
    {showConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowConfirm(false)}></div>
        <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-yellow-500/10 rounded-full border border-yellow-500/20">
              <AlertTriangle className="text-yellow-500" size={32} />
            </div>
            <h3 className="text-lg font-medium text-white">Check Report Date</h3>
            <p className="text-zinc-400 text-sm">
              You are about to save a report for <span className="text-white font-mono">{formData.date}</span>, which is not today's date.
              <br /><br />
              Are you sure you want to proceed?
            </p>
            <div className="flex gap-3 w-full pt-2">
              <button 
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                disabled={isSaving}
              >
                Go Back
              </button>
              <button 
                onClick={processSave}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-black hover:bg-zinc-200 transition-colors"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Yes, Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* New Account Creation Modal */}
    {showAccountCreator && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAccountCreator(false)}></div>
        <div className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">New Account Profile</h3>
            <button onClick={() => setShowAccountCreator(false)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium ml-1">Account Name</label>
                <input 
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-white/20 focus:bg-white/5 transition-all"
                    placeholder="e.g. My New Shop"
                    autoFocus
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium ml-1">Security Code</label>
                <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                        <Lock size={14} />
                    </div>
                    <input 
                        type="password"
                        value={securityCode}
                        onChange={(e) => setSecurityCode(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-white/20 focus:bg-white/5 transition-all"
                        placeholder="Required to create"
                    />
                </div>
            </div>

            {accountError && (
                <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded-lg border border-red-400/20">
                    {accountError}
                </div>
            )}

            <button 
                onClick={handleCreateAccount}
                className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
                <CheckCircle2 size={16} /> Create Profile
            </button>
          </div>
        </div>
      </div>
    )}

    </>
  );
};

// Sub-component for managing shipping breakdown (cards list + balance)
const ShippingEditor = ({ 
  title, 
  data, 
  onChange, 
  total 
}: { 
  title: string, 
  data: ShippingBreakdown, 
  onChange: (newBreakdown: ShippingBreakdown) => void,
  total: number
}) => {
  const addCard = () => {
    const newCard = { id: Math.random().toString(36).substr(2, 9), last4: '', amount: 0 };
    onChange({ ...data, cards: [...data.cards, newCard] });
  };

  const updateCard = (id: string, field: 'last4' | 'amount', value: string) => {
    const updatedCards = data.cards.map(c => {
      if (c.id === id) {
        return { 
          ...c, 
          [field]: field === 'amount' ? (parseFloat(value) || 0) : value 
        };
      }
      return c;
    });
    onChange({ ...data, cards: updatedCards });
  };

  const removeCard = (id: string) => {
    onChange({ ...data, cards: data.cards.filter(c => c.id !== id) });
  };

  const updateBalance = (value: string) => {
    onChange({ ...data, balance: parseFloat(value) || 0 });
  };

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
      <div className="flex justify-between items-center mb-3">
        <label className="text-xs text-zinc-400 uppercase tracking-wide">{title}</label>
        <button 
          type="button" 
          onClick={addCard}
          className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors font-medium px-2 py-1 rounded bg-emerald-400/10 hover:bg-emerald-400/20"
        >
          <Plus size={12} /> Add Card
        </button>
      </div>
      
      <div className="space-y-3">
        {data.cards.map((card, index) => (
          <div key={card.id} className="flex gap-3 items-end animate-in fade-in slide-in-from-top-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-zinc-500 ml-1">Card Last 4</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  <CreditCard size={14} />
                </div>
                <input
                  type="text"
                  maxLength={4}
                  value={card.last4}
                  onChange={(e) => updateCard(card.id, 'last4', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-white/20 focus:bg-white/5 transition-all font-mono"
                  placeholder="0000"
                />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-zinc-500 ml-1">Amount</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  $
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={card.amount}
                  onChange={(e) => updateCard(card.id, 'amount', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-white/20 focus:bg-white/5 transition-all font-mono"
                  placeholder="0.00"
                />
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => removeCard(card.id)}
              className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
              title="Remove Card"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        
        {/* Balance Input - Fixed at bottom */}
        <div className="flex gap-3 items-end pt-2 border-t border-white/5">
           <div className="flex-1">
             <div className="flex items-center gap-2 h-[42px] px-3 text-sm text-zinc-400">
                <Wallet size={16} />
                <span className="font-medium">Account Balance</span>
             </div>
           </div>
           <div className="flex-1 space-y-1">
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  $
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={data.balance}
                  onChange={(e) => updateBalance(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-white/20 focus:bg-white/5 transition-all font-mono"
                  placeholder="0.00"
                />
              </div>
           </div>
           {/* Spacer to align with remove button column */}
           <div className="w-[42px]"></div> 
        </div>
      </div>
      
      <div className="mt-3 text-right text-xs text-zinc-500 font-mono">
        Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
      </div>
    </div>
  );
};

// Sub-component for managing Payout Breakdown
const PayoutEditor = ({ 
    data, 
    onChange,
    availableAccounts,
    onCreateAccount
  }: { 
    data: PayoutBreakdown, 
    onChange: (newBreakdown: PayoutBreakdown) => void,
    availableAccounts: {id: string, name: string}[],
    onCreateAccount: () => void
  }) => {
    
    // Safety check for initialization
    const accounts = data?.accounts || [];
    const total = data?.total || 0;

    const addAccount = () => {
      const newAccount = { id: Math.random().toString(36).substr(2, 9), name: '', amount: 0 };
      updateData([...accounts, newAccount]);
    };
  
    const updateAccount = (id: string, field: 'name' | 'amount', value: string) => {
      const updatedAccounts = accounts.map(a => {
        if (a.id === id) {
          return { 
            ...a, 
            [field]: field === 'amount' ? (parseFloat(value) || 0) : value 
          };
        }
        return a;
      });
      updateData(updatedAccounts);
    };
  
    const removeAccount = (id: string) => {
      updateData(accounts.filter(a => a.id !== id));
    };

    const updateData = (newAccounts: any[]) => {
        const newTotal = newAccounts.reduce((sum, a) => sum + a.amount, 0);
        onChange({ accounts: newAccounts, total: newTotal });
    };
  
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
        <div className="flex justify-between items-center mb-3">
          <label className="text-xs text-zinc-400 uppercase tracking-wide">Expected Weekly Payout Breakdown</label>
          <div className="flex gap-2">
            <button 
                type="button" 
                onClick={onCreateAccount}
                className="text-xs flex items-center gap-1 text-zinc-400 hover:text-white transition-colors font-medium px-2 py-1 rounded bg-white/5 hover:bg-white/10"
            >
                <Plus size={10} /> Create Profile
            </button>
            <button 
                type="button" 
                onClick={addAccount}
                className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors font-medium px-2 py-1 rounded bg-emerald-400/10 hover:bg-emerald-400/20"
            >
                <Plus size={12} /> Add Account
            </button>
          </div>
        </div>
        
        <div className="space-y-3">
            {accounts.length === 0 && (
                <div className="text-center py-4 text-xs text-zinc-600 italic">No accounts added yet. Add one to set the weekly payout.</div>
            )}
          {accounts.map((account) => (
            <div key={account.id} className="flex gap-3 items-end animate-in fade-in slide-in-from-top-2">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-zinc-500 ml-1">Account Name</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                    <Building2 size={14} />
                  </div>
                  <select
                    value={account.name}
                    onChange={(e) => updateAccount(account.id, 'name', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-white/5 transition-all appearance-none"
                  >
                    <option value="" disabled className="text-zinc-600">Select Account</option>
                    {availableAccounts.map(opt => (
                        <option key={opt.id} value={opt.name} className="bg-zinc-900 text-zinc-200">{opt.name}</option>
                    ))}
                    {/* Fallback for existing data that might not be in DB yet or legacy */}
                    {account.name && !availableAccounts.find(a => a.name === account.name) && (
                        <option value={account.name} className="bg-zinc-900 text-zinc-200">{account.name}</option>
                    )}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                     <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-zinc-500 ml-1">Amount</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                    $
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={account.amount}
                    onChange={(e) => updateAccount(account.id, 'amount', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-7 pr-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-white/20 focus:bg-white/5 transition-all font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => removeAccount(account.id)}
                className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                title="Remove Account"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="mt-3 pt-2 border-t border-white/5 flex justify-between items-center">
            <span className="text-xs text-zinc-500">Total Payout</span>
            <span className="text-sm font-mono text-zinc-200">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
            </span>
        </div>
      </div>
    );
  };

const InputGroup = ({ 
  label, 
  value, 
  onChange, 
  icon 
}: { 
  label: string, 
  value: number, 
  onChange: (val: string) => void,
  icon: React.ReactNode 
}) => (
  <div className="space-y-1.5">
    <label className="text-xs text-zinc-500 font-medium ml-1">{label}</label>
    <div className="relative group">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors pointer-events-none">
        {typeof icon === 'string' ? <span className="font-mono">{icon}</span> : icon}
      </div>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-white/20 focus:bg-white/5 focus:ring-1 focus:ring-white/10 transition-all font-mono"
        placeholder="0.00"
      />
    </div>
  </div>
);