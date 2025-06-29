
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ children, className = '', variant = 'primary', ...props }) => {
  const baseStyle = "px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all duration-150 ease-in-out";
  
  let variantStyle = '';
  switch (variant) {
    case 'secondary':
      variantStyle = 'bg-slate-600 hover:bg-slate-700 text-white focus:ring-slate-500';
      break;
    case 'danger':
      variantStyle = 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';
      break;
    case 'primary':
    default:
      variantStyle = 'bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-400';
      break;
  }

  return (
    <button
      className={`${baseStyle} ${variantStyle} ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
