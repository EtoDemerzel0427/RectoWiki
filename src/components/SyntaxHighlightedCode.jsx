import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

const SyntaxHighlightedCode = ({ language, children, ...props }) => (
    <SyntaxHighlighter
        style={tomorrow}
        language={language}
        PreTag="div"
        customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
        {...props}
    >
        {children}
    </SyntaxHighlighter>
);

export default SyntaxHighlightedCode;
