const LoadingSpinner = ({ 
  size = 'medium', 
  message = 'Загрузка...', 
  subMessage = null,
  className = '' 
}) => {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  };

  return (
    <div className={`loading-spinner-container ${className}`}>
      <div className={`loading-spinner ${sizeClasses[size]}`}>
        <div className="spinner"></div>
      </div>
      
      {message && (
        <div className="loading-message">
          <p className="main-message">{message}</p>
          {subMessage && (
            <p className="sub-message">{subMessage}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
