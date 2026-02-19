/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#3B82F6",
                "background-dark": "#0B1120",
                "card-dark": "#151e32",
                "text-dark": "#E5E7EB",
                "text-muted-dark": "#9CA3AF",
                "border-dark": "#1f2937",
                "accent-green": "#10B981",
                "accent-red": "#EF4444",
            },
            fontFamily: {
                display: ["Inter", "sans-serif"],
            },
        },
    },
    plugins: [],
}
