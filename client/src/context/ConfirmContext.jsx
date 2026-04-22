import { createContext, useContext, useState, useCallback, useRef } from 'react';
import '../components/ConfirmModal.css';

const ConfirmContext = createContext();

export function ConfirmProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const resolveRef = useRef(null);

    const confirm = useCallback((msg) => {
        setMessage(msg);
        setIsOpen(true);
        return new Promise((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        setIsOpen(false);
        resolveRef.current?.(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        resolveRef.current?.(false);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {isOpen && (
                <div className="confirm-overlay" onClick={handleCancel}>
                    <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                        <p className="confirm-message">{message}</p>
                        <div className="confirm-actions">
                            <button className="confirm-btn cancel" onClick={handleCancel}>Cancel</button>
                            <button className="confirm-btn accept" onClick={handleConfirm}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

export const useConfirm = () => useContext(ConfirmContext);
