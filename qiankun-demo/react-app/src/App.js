import React, { useState } from 'react';
import './App.css';

function App (props) {
    const [count, setCount] = useState(0);
    const changeUser = () => {
        setCount(count + 1);
        // 接收主应用传递过来的eventBus，并发送事件给主应用
        props.eventBus?.emit('global-message', { from: 'react-app', count });
    };

    return (
        <div className="App">
            <button onClick={changeUser}>点击 {count}</button>
        </div>
    );
}

export default App;
