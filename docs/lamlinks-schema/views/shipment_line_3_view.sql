-- dbo.shipment_line_3_view



/* view shipment_line_3_view: add view */


/* view shipment_line_3_view: add view */


/* view shipment_line_3_view: add view */

/* view shipment_line_3_view: add view */


/* view shipment_line_3_view: add view */


/* view shipment_line_3_view: add view */


/* view shipment_line_3_view: add view */
CREATE VIEW [dbo].[shipment_line_3_view]
AS
SELECT        dbo.gduset_1_view.gduset_ka7 AS gduset_prm, dbo.gduset_1_view.d_code_ka7 AS d_code_prm, dbo.gduset_1_view.d_name_ka7 AS d_name_prm, dbo.gduset_1_view.idnk12_ka7 AS idnk12_prm, 
                         dbo.shipment_line_2_view.*
FROM            dbo.shipment_line_2_view INNER JOIN
                         dbo.gduset_1_view ON dbo.shipment_line_2_view.idnkaj_kaj = dbo.gduset_1_view.idngdu_ka6
WHERE        (dbo.gduset_1_view.gdutbl_ka6 = 'kaj') AND (dbo.gduset_1_view.gduset_ka7 = 'MIRR Block 9. Prime Contractor')







