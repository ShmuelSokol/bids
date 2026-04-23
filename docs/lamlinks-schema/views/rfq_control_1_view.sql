-- dbo.rfq_control_1_view



/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */

/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */


/* view rfq_control_1_view: add view */
CREATE VIEW [dbo].[rfq_control_1_view]
AS
SELECT        TOP (100) PERCENT K39_tab.s_code_k39, K39_tab.s_attn_k39, K42_tab.rfq_no_k42, k36_rfq_view.email_k36 AS e_mail_rfq, k36_rfq_view.rfqpoc_k36 AS pocnam_rfq, k36_rfq_view.idnk36_k36 AS idnk36_rfq, 
                         k36_vendor_view.rfqpoc_k36 AS pocnam_vnd, k36_vendor_view.email_k36 AS e_mail_vnd, k36_vendor_view.idnk36_k36 AS idnk36_vnd, K39_tab.idnk39_k39, K42_tab.idnk42_k42
FROM            dbo.k42_tab AS K42_tab INNER JOIN
                         dbo.k39_tab AS K39_tab ON K42_tab.idnk39_k42 = K39_tab.idnk39_k39 INNER JOIN
                         dbo.k41_tab AS K41_tab ON K42_tab.idnk41_k42 = K41_tab.idnk41_k41 INNER JOIN
                         dbo.k36_tab AS k36_rfq_view ON K41_tab.idnk36_k41 = k36_rfq_view.idnk36_k36 LEFT OUTER JOIN
                         dbo.k36_tab AS k36_vendor_view ON K39_tab.idnk36_k39 = k36_vendor_view.idnk36_k36















