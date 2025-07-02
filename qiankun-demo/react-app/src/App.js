import React, { useState } from 'react';
import './App.css';

function App () {
    const [count, setCount] = useState(0);
    const changeUser = (entity) => {
        setCount(count + 1);
        window._QIANKUN_YD.event.emit('change-user', { count });
    };
    return (
        <div className='App'>
            <button onClick={() => { changeUser() }}>点击 {count}</button>
        </div>
    );
}

export default App;
