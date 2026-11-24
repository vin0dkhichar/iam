interface StatusBadgeProps {
  active?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export default function StatusBadge({
  active,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
  onClick,
  disabled = false,
}: StatusBadgeProps) {
  const className = `inline-block px-4 py-2 rounded-[10px] text-[16px] font-medium ${active !== false ? "bg-[rgba(39,174,96,0.12)] text-[#27ae60]" : "bg-[rgba(196,196,196,0.3)] text-gray-600"}${onClick && !disabled ? " cursor-pointer hover:opacity-80" : ""}${disabled ? " opacity-50 cursor-not-allowed" : ""}`;

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) onClick();
        }}
        disabled={disabled}
      >
        {active !== false ? activeLabel : inactiveLabel}
      </button>
    );
  }

  return (
    <span className={className}>
      {active !== false ? activeLabel : inactiveLabel}
    </span>
  );
}
