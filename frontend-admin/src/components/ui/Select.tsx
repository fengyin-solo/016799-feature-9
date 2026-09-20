import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  hidePlaceholder?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  options,
  onChange,
  icon,
  placeholder = '请选择',
  hidePlaceholder = false,
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          {icon && <span className="text-dark-400">{icon}</span>}
          <span className="label-text mb-0">{label}</span>
        </div>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="select-field pr-10"
        >
          {!hidePlaceholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400 pointer-events-none" />
      </div>
    </div>
  );
};
