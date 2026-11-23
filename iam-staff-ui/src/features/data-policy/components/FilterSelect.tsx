'use client';

import CustomDropdown from './CustomDropdown';

type Option = {
    label: string;
    value: string;
};

interface FilterSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    loading?: boolean;
    placeholder?: string;
    className?: string;
}

export default function FilterSelect({
    options,
    value,
    onChange,
    disabled,
    loading,
    placeholder,
    className = '',
}: FilterSelectProps) {
    return (
        <div className={className}>
            <CustomDropdown
                options={options}
                value={value}
                onChange={onChange}
                disabled={disabled}
                loading={loading}
                placeholder={placeholder}
                inline
            />
        </div>
    );
}
