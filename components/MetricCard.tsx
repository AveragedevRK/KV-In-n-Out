import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface SubItem {
  icon?: LucideIcon;
  label: string;
  amount: number;
}

interface MetricCardProps {
  label: string;
  amount: number;
  icon: LucideIcon;
  iconColor: string;
  accentColor: string;
  textColor?: string;
  subItems?: SubItem[];
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  amount,
  icon: Icon,
  iconColor,
  accentColor,
  textColor,
  subItems
}) => {
  
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className={`group relative w-full min-h-[5rem] md:min-h-[7rem] flex flex-col justify-between overflow-hidden rounded-xl md:rounded-2xl border border-white/5 bg-white/5 p-4 md:p-5 backdrop-blur-2xl transition-all duration-300 hover:border-white/10 hover:bg-white/10 hover:shadow-lg hover:shadow-black/20`}>
      
      {/* Glossy top reflection */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50"></div>
      
      {/* Subtle indicator bar on left - glowing */}
      <div className={`absolute left-0 top-3 bottom-3 md:top-4 md:bottom-4 w-0.5 rounded-r-full opacity-80 shadow-[0_0_10px_currentColor] ${accentColor.replace('bg-', 'text-') /* Hack to reuse color class for shadow if needed, but accentColor is bg class usually. Let's just use the bg class provided */ } ${accentColor}`}></div>

      <div className="flex items-center justify-between mb-1.5 md:mb-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className={`${iconColor} opacity-90 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]`}>
            <Icon size={14} className="md:w-4 md:h-4" strokeWidth={2} />
          </div>
          <p className="text-[10px] md:text-[11px] font-bold text-zinc-400 uppercase tracking-widest truncate select-none">{label}</p>
        </div>
      </div>
      
      <div className="relative z-10 flex flex-col justify-end flex-1">
          <h3 
            className={`text-xl md:text-2xl lg:text-3xl font-light tracking-tight tabular-nums select-none truncate w-full drop-shadow-sm ${textColor ? textColor : 'text-zinc-100'}`}
            title={formatCurrency(amount)}
          >
            {formatCurrency(amount)}
          </h3>

          {subItems && (
            <div className="mt-2 md:mt-3 pt-2 border-t border-white/5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-300">
              {subItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-[10px] text-zinc-400/80">
                  <div className="flex items-center gap-1.5">
                    {item.icon && <item.icon size={10} className="text-zinc-500" />}
                    <span className="font-medium tracking-wide">{item.label}</span>
                  </div>
                  <span className="font-mono text-zinc-300">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};