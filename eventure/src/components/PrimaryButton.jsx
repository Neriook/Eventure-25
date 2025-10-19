import React from 'react';

function PrimaryButton({ children, onClick, type = 'button', className = '', ...rest }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-full bg-gray-200 px-6 py-3 text-base font-semibold text-gray-900 transition-colors duration-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default PrimaryButton;
