import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

const Button = ({ children, className = '', ...props }: ButtonProps) => {
  return (
    <button className={`button ${className}`.trim()} {...props}>
      {children}
    </button>
  );
};

export default Button;
