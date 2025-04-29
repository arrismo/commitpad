/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
          },
        },
      },
    },
  },
  plugins: [
    function({ addComponents }) {
      addComponents({
        '.prose': {
          '& h1': {
            fontSize: '1.875rem',
            marginTop: '1.875rem',
            marginBottom: '1.25rem',
            fontWeight: '700',
            lineHeight: '1.2',
          },
          '& h2': {
            fontSize: '1.5rem',
            marginTop: '1.5rem',
            marginBottom: '1rem',
            fontWeight: '600',
            lineHeight: '1.3',
          },
          '& h3': {
            fontSize: '1.25rem',
            marginTop: '1.25rem',
            marginBottom: '0.75rem',
            fontWeight: '600',
            lineHeight: '1.4',
          },
          '& p': {
            marginTop: '1rem',
            marginBottom: '1rem',
          },
          '& ul': {
            marginTop: '1rem',
            marginBottom: '1rem',
            paddingLeft: '1.5rem',
            listStyleType: 'disc',
          },
          '& ol': {
            marginTop: '1rem',
            marginBottom: '1rem',
            paddingLeft: '1.5rem',
            listStyleType: 'decimal',
          },
          '& li': {
            marginTop: '0.5rem',
            marginBottom: '0.5rem',
          },
          '& blockquote': {
            fontStyle: 'italic',
            borderLeftWidth: '4px',
            borderLeftColor: '#e5e7eb',
            paddingLeft: '1rem',
            marginTop: '1.25rem',
            marginBottom: '1.25rem',
          },
          '& code': {
            backgroundColor: '#f3f4f6',
            borderRadius: '0.25rem',
            padding: '0.125rem 0.25rem',
            fontSize: '0.875rem',
          },
          '& pre': {
            backgroundColor: '#f3f4f6',
            borderRadius: '0.375rem',
            padding: '1rem',
            overflowX: 'auto',
            marginTop: '1.25rem',
            marginBottom: '1.25rem',
          },
          '& a': {
            color: '#2563eb',
            textDecoration: 'underline',
          },
          '& table': {
            width: '100%',
            tableLayout: 'auto',
            textAlign: 'left',
            marginTop: '1.25rem',
            marginBottom: '1.25rem',
          },
          '& th': {
            fontWeight: '600',
            padding: '0.75rem',
            borderBottomWidth: '1px',
            borderColor: '#e5e7eb',
          },
          '& td': {
            padding: '0.75rem',
            borderBottomWidth: '1px',
            borderColor: '#e5e7eb',
          },
        },
        '.prose-invert': {
          '& code': {
            backgroundColor: '#1f2937',
          },
          '& pre': {
            backgroundColor: '#1f2937',
          },
          '& blockquote': {
            borderLeftColor: '#4b5563',
          },
          '& a': {
            color: '#3b82f6',
          },
          '& th': {
            borderColor: '#4b5563',
          },
          '& td': {
            borderColor: '#4b5563',
          },
        },
      });
    },
  ],
};