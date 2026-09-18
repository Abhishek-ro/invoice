import React, { useState, useRef, useEffect, useCallback } from 'react';
import './LanguageSelector.css';

// Default common languages
const DEFAULT_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Chinese (Simplified)',
  'Chinese (Traditional)',
  'Japanese',
  'Hindi',
  'Arabic',
  'Portuguese',
  'Russian',
  'Italian',
  'Korean',
  'Dutch',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Polish',
  'Turkish',
  'Greek',
  'Hebrew',
  'Thai',
  'Vietnamese',
  'Indonesian',
  'Malay',
  'Czech',
  'Hungarian',
  'Romanian',
  'Bulgarian'
];

const LanguageSelector = ({
  value,
  onChange,
  placeholder = "Select or type language...",
  isDisabled = false,
  isLoading = false,
  className = "",
  languages = DEFAULT_LANGUAGES,
  width = "100%",
  minWidth = "200px"
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredLanguages, setFilteredLanguages] = useState(languages);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 200 });
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const dropdownRef = useRef(null);

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Filter languages based on input
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredLanguages(languages);
    } else {
      const filtered = languages.filter(lang =>
        lang.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredLanguages(filtered);
    }
    setHighlightedIndex(-1);
  }, [inputValue, languages]);

  // Calculate dropdown position when opening or scrolling
  const updateDropdownPosition = useCallback((forceOpen = false) => {
    if ((isOpen || forceOpen) && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 300; // max-height from CSS
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Only flip up if space below is very limited (less than 180px) and there's more space above
      const showAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      
      // For fixed positioning, use viewport coordinates directly (no scroll offset)
      setDropdownPosition({
        top: showAbove 
          ? rect.top - dropdownHeight - 4
          : rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        updateDropdownPosition();
      });
    }
  }, [isOpen, updateDropdownPosition]);

  // Update position on scroll and resize
  useEffect(() => {
    if (isOpen) {
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use a small delay to avoid immediate closing
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (isDisabled || isLoading) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(prev => 
          prev < filteredLanguages.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredLanguages[highlightedIndex]) {
          handleSelect(filteredLanguages[highlightedIndex]);
        } else if (inputValue.trim()) {
          handleSelect(inputValue.trim());
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        setIsOpen(true);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    // Only call onChange if value changed to avoid unnecessary updates
    if (newValue !== value) {
      onChange(newValue);
    }
    // Ensure dropdown opens when typing
    if (!isOpen) {
      setIsOpen(true);
    }
    // Immediately update position when typing
    updateDropdownPosition(true);
  };

  const handleSelect = (selectedLanguage) => {
    setInputValue(selectedLanguage);
    onChange(selectedLanguage);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleFocus = () => {
    if (!isDisabled && !isLoading) {
      setIsOpen(true);
      setFilteredLanguages(languages);
      setTimeout(() => {
        updateDropdownPosition(true);
      }, 0);
    }
  };

  const handleInputClick = () => {
    if (!isDisabled && !isLoading) {
      setIsOpen(true);
      setFilteredLanguages(languages);
      setTimeout(() => {
        updateDropdownPosition(true);
      }, 0);
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex]);

  const containerStyle = {
    width: width === '100%' ? '100%' : width,
    minWidth: minWidth,
    maxWidth: width === '100%' ? '100%' : 'none',
    boxSizing: 'border-box',
    position: 'relative'
  };

  return (
    <div 
      ref={containerRef}
      className={`language-selector-container ${className}`} 
      style={containerStyle}
    >
      <div className="language-selector-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "Loading..." : placeholder}
          disabled={isDisabled || isLoading}
          className="language-selector-input"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        <span className="language-selector-arrow">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>
      
      {isOpen && !isDisabled && !isLoading && (
        <div 
          ref={dropdownRef}
          className="language-selector-dropdown" 
          role="listbox"
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 10000
          }}
        >
          <ul ref={listRef} className="language-selector-list">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((lang, index) => (
                <li
                  key={lang}
                  className={`language-selector-option ${
                    index === highlightedIndex ? 'highlighted' : ''
                  } ${lang === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(lang)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  role="option"
                  aria-selected={lang === value}
                >
                  {lang}
                </li>
              ))
            ) : (
              <li className="language-selector-option no-results">
                No languages found. Press Enter to use "{inputValue}"
              </li>
            )}
            {inputValue.trim() && 
             !filteredLanguages.some(lang => 
               lang.toLowerCase() === inputValue.toLowerCase()
             ) && (
              <li
                className={`language-selector-option create-new ${
                  highlightedIndex === filteredLanguages.length ? 'highlighted' : ''
                }`}
                onClick={() => handleSelect(inputValue.trim())}
                onMouseEnter={() => setHighlightedIndex(filteredLanguages.length)}
                role="option"
              >
                <span className="create-icon">+</span>
                Use "{inputValue.trim()}"
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
