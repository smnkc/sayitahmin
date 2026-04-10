<?php
// Set headers
header('Content-Type: application/json');
header('Cache-Control: no-store, must-revalidate');

$data_dir = __DIR__ . '/data';
if (!is_dir($data_dir)) {
    mkdir($data_dir, 0755, true);
}

// 1. Cleanup routine
function cleanup_rooms() {
    global $data_dir;
    $now = time();
    $files = glob($data_dir . '/room_*.json');
    if ($files) {
        foreach ($files as $file) {
            $content = @file_get_contents($file);
            if (!$content) continue;
            
            $data = json_decode($content, true);
            if (!$data) continue;
            
            $state = isset($data['state']) ? $data['state'] : 'waiting';
            $created_at = isset($data['created_at']) ? $data['created_at'] : $now;
            $finished_at = isset($data['finished_at']) ? $data['finished_at'] : null;
            
            if ($state === 'waiting' || $state === 'setup' || $state === 'playing') {
                if ($now - $created_at > 600) {
                    @unlink($file);
                }
            } else if ($state === 'finished' || $state === 'abandoned') {
                if ($finished_at && ($now - $finished_at > 60)) {
                    @unlink($file);
                }
            }
        }
    }
}
// Run garbage collection on 100% of API calls (since it's lightweight file metadata checks on very few files)
cleanup_rooms();

// Helpers
function get_room_path($room_id) {
    global $data_dir;
    $safe_id = preg_replace('/[^a-zA-Z0-9]/', '', $room_id);
    return $data_dir . '/room_' . $safe_id . '.json';
}

function load_room($room_id) {
    $path = get_room_path($room_id);
    if (file_exists($path)) {
        $content = file_get_contents($path);
        return json_decode($content, true);
    }
    return null;
}

function save_room($room_id, $data) {
    $path = get_room_path($room_id);
    file_put_contents($path, json_encode($data));
}

// Parse request
$route = isset($_GET['route']) ? $_GET['route'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// Get POST data
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) $input = [];

// API Logic
if ($method === 'GET' && $route === 'room/status') {
    $room_id = isset($_GET['id']) ? $_GET['id'] : null;
    $player_id = isset($_GET['playerId']) ? $_GET['playerId'] : null;
    
    if (!$room_id || !$player_id) {
        http_response_code(400);
        echo json_encode(["error" => "Missing params"]);
        exit;
    }
    
    $room = load_room($room_id);
    if (!$room) {
        http_response_code(404);
        echo json_encode(["error" => "Not found"]);
        exit;
    }
    
    $opponent = ($player_id === 'p1') ? 'p2' : 'p1';
    if ($room[$opponent]['secret'] !== null && $room['state'] !== 'finished') {
        $room[$opponent]['secret'] = "HIDDEN";
    }
    
    echo json_encode($room);
    exit;
}

if ($method === 'POST') {
    if ($route === 'room') {
        $room_id = substr(str_shuffle("0123456789"), 0, 6);
        $room = [
            "id" => $room_id,
            "created_at" => time(),
            "state" => "waiting",
            "turn" => "p1",
            "winner" => null,
            "p1" => ["secret" => null, "last_guess" => null, "last_feedback" => null],
            "p2" => ["secret" => null, "last_guess" => null, "last_feedback" => null]
        ];
        save_room($room_id, $room);
        echo json_encode(["id" => $room_id, "playerId" => "p1"]);
        exit;
    }
    
    if ($route === 'room/join') {
        $room_id = isset($input['id']) ? $input['id'] : null;
        if (!$room_id) {
            http_response_code(400);
            exit;
        }
        $room = load_room($room_id);
        if (!$room || $room['state'] !== 'waiting') {
            http_response_code(400);
            echo json_encode(["error" => "Oda bulunamadı veya oynanıyor"]);
            exit;
        }
        $room['state'] = 'setup';
        save_room($room_id, $room);
        echo json_encode(["id" => $room_id, "playerId" => "p2"]);
        exit;
    }
    
    if ($route === 'room/action') {
        $room_id = isset($input['id']) ? $input['id'] : null;
        $player_id = isset($input['playerId']) ? $input['playerId'] : null;
        $action = isset($input['action']) ? $input['action'] : null;
        $value = isset($input['value']) ? intval($input['value']) : 0;
        
        $room = load_room($room_id);
        if (!$room) {
            http_response_code(404);
            exit;
        }
        
        if ($action === "set_secret") {
            $room[$player_id]['secret'] = $value;
            if ($room['p1']['secret'] !== null && $room['p2']['secret'] !== null) {
                $room['state'] = 'playing';
            }
        } else if ($action === "guess") {
            if ($room['state'] !== 'playing' || $room['turn'] !== $player_id) {
                http_response_code(400);
                echo json_encode(["error" => "Sıra sizde değil veya oyun başlamadı"]);
                exit;
            }
            
            $opponent_id = ($player_id === 'p1') ? 'p2' : 'p1';
            $opp_secret = $room[$opponent_id]['secret'];
            
            $room[$player_id]['last_guess'] = $value;
            
            if ($value === $opp_secret) {
                $room[$player_id]['last_feedback'] = 'correct';
                $room['state'] = 'finished';
                $room['winner'] = $player_id;
                $room['finished_at'] = time();
            } else if ($value < $opp_secret) {
                $room[$player_id]['last_feedback'] = 'up';
                $room['turn'] = $opponent_id;
            } else {
                $room[$player_id]['last_feedback'] = 'down';
                $room['turn'] = $opponent_id;
            }
        }
        save_room($room_id, $room);
        echo json_encode(["success" => true]);
        exit;
    }
    
    if ($route === 'room/leave') {
        $room_id = isset($input['id']) ? $input['id'] : null;
        if ($room_id) {
            $room = load_room($room_id);
            if ($room && $room['state'] !== 'finished' && $room['state'] !== 'abandoned') {
                $room['state'] = 'abandoned';
                $room['finished_at'] = time();
                save_room($room_id, $room);
            }
        }
        echo json_encode(["success" => true]);
        exit;
    }
}

http_response_code(404);
echo json_encode(["error" => "Invalid endpoint"]);
?>
