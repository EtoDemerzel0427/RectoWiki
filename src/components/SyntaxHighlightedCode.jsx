import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';

[
    ['bash', bash], ['shell', bash], ['sh', bash],
    ['cpp', cpp], ['c++', cpp],
    ['javascript', javascript], ['js', javascript],
    ['json', json], ['jsx', jsx],
    ['markdown', markdown], ['md', markdown],
    ['python', python], ['py', python],
    ['tsx', tsx], ['typescript', typescript], ['ts', typescript],
    ['yaml', yaml], ['yml', yaml],
].forEach(([name, grammar]) => SyntaxHighlighter.registerLanguage(name, grammar));

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
