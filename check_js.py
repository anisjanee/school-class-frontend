import esprima
import sys

def check(path):
    code = open(path, 'r', encoding='utf-8').read()
    try:
        esprima.parseScript(code)
        print('parsed')
    except Exception as e:
        print('parse error', e)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        check(sys.argv[1])
    else:
        check('script.js')