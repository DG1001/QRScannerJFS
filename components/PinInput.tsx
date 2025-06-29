import React, { useState } from 'react';

interface PinInputProps {
  correctPin: string;
  onPinVerified: () => void;
}

const PinInput: React.FC<PinInputProps> = ({ correctPin, onPinVerified }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      localStorage.setItem('pin_verified', 'true');
      onPinVerified();
    } else {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="pin-input-container">
      <h2>Enter PIN Code</h2>
      <p>Please enter the 4-digit code to use the scanner.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="pin-input"
          autoFocus
        />
        <button type="submit" className="pin-submit-button">Submit</button>
        {error && <p className="pin-error">{error}</p>}
      </form>
    </div>
  );
};

export default PinInput;
