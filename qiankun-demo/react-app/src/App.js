import { useState } from 'react';
import './App.css';

function App({ actions }) {
  const [count, setCount] = useState(0);

  const changeUser = () => {
    const nextCount = count + 1;
    setCount(nextCount);
    actions?.setGlobalState({
      globalMessage: {
        from: 'react-app',
        count: nextCount,
        timestamp: Date.now()
      }
    });
  };

  return (
    <div className='App'>
      <button onClick={changeUser}>Click {count}</button>
    </div>
  );
}

export default App;
