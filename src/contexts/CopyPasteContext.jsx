import { createContext, useContext, useState } from 'react';

const CopyPasteContext = createContext(null);

export const CopyPasteProvider = ({ children }) => {
  const [copiedData, setCopiedData] = useState(null);

  const copyCellData = (cellData) => {
    setCopiedData({
      gift: cellData.gift || '',
      model: cellData.model || '',
      backdrop: cellData.backdrop || '',
      pattern: cellData.pattern || '',
    });
  };

  const getCopiedData = () => {
    return copiedData;
  };

  const hasCopiedData = () => {
    return copiedData !== null && copiedData.gift !== null && copiedData.gift !== '';
  };

  return (
    <CopyPasteContext.Provider value={{ copyCellData, getCopiedData, hasCopiedData }}>
      {children}
    </CopyPasteContext.Provider>
  );
};

export const useCopyPaste = () => {
  const context = useContext(CopyPasteContext);
  if (!context) {
    throw new Error('useCopyPaste must be used within CopyPasteProvider');
  }
  return context;
};
