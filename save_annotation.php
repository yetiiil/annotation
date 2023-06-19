<?php
// Retrieve the JSON data from the request body
$jsonData = file_get_contents('php://input');

// Decode the JSON data into a PHP object
$annotationData = json_decode($jsonData);

// Save the annotation data to a file
$filename = 'annotation_data.json';
file_put_contents($filename, $jsonData);

// Send a response indicating the success of saving the data
$response = array('message' => 'Annotation data saved successfully');
echo json_encode($response);
?>
