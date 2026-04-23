-- dbo.rfq_control_our_poc_2_view



/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */

/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */


/* view rfq_control_our_poc_2_view: add view */
CREATE VIEW [dbo].[rfq_control_our_poc_2_view]
AS
SELECT        dbo.group_member_1_view.u_name_k14, dbo.group_member_1_view.catitl_kap, dbo.group_member_1_view.idnk14_k14, dbo.rfq_control_our_poc_1_view.email_k36, 
                         dbo.rfq_control_our_poc_1_view.rfqpoc_k36, dbo.rfq_control_our_poc_1_view.a_note_kah
FROM            dbo.rfq_control_our_poc_1_view LEFT OUTER JOIN
                         dbo.group_member_1_view ON dbo.rfq_control_our_poc_1_view.idnk14_k14 = dbo.group_member_1_view.idnk14_k14















