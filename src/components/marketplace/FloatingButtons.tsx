import React from 'react';
import { PhoneCall, ArrowUp } from 'lucide-react';

export const FloatingButtons: React.FC = () => {
  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-2.5">
      <a
        href="https://wa.me/213000000000"
        target="_blank"
        rel="noopener noreferrer"
        className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        aria-label="WhatsApp Support"
      >
        <PhoneCall className="w-5 h-5" />
      </a>

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 text-gray-700 shadow-md border border-gray-200 flex items-center justify-center transition-transform hover:scale-105"
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-4 h-4" />
      </button>
    </div>
  );
};

export default FloatingButtons;
