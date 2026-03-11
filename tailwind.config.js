/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html"],
    darkMode: "class",
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            colors: {
                brand: {
                    50: '#edfcf5',
                    100: '#d3f8e6',
                    200: '#aaf0d1',
                    300: '#73e2b7',
                    400: '#3acf99',
                    500: '#1ab47f',
                    600: '#0e9268',
                    700: '#0b7555',
                    800: '#0c5d45',
                    900: '#0b4d3a',
                },
                surface: {
                    50: '#f0f4f3',
                    100: '#e2e8f0',
                    700: '#1e2836',
                    800: '#161d2b',
                    900: '#0f1520',
                    950: '#0b1018',
                },
            },
        },
    },
    plugins: [],
}
